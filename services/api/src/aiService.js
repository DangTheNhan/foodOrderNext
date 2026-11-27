import { menuSelectionSchema, reviewSelectionSchema } from '@foodordernext/contracts';
import { digest } from './orderPricing.js';
import { ApiError } from './errors.js';
import { fallbackMenu, menuInstructions, menuPlans, menuPrompt, pricedMenu } from './aiMenu.js';
import { buildReviewInsight, reviewInstructions, reviewInterval, reviewPrompt, selectedReviewInsight } from './aiReviews.js';

const ttl = { aiMenuCache: 5 * 60_000, aiInsightCache: 15 * 60_000 };
const hasReviews = ({ reviews }) => {
  if (reviews.length < 3) throw new ApiError(422, 'INSUFFICIENT_DATA', 'Cần ít nhất 3 đánh giá đã xác minh.',
    { sampleSize: reviews.length, minSampleSize: 3 });
};

export class FoodOrderAi {
  inflight = new Map();

  constructor(repository, gateway, clock = Date.now) {
    this.repository = repository;
    this.gateway = gateway;
    this.clock = clock;
  }

  async generate({ collection, key, input, initial, refresh, validate, task, uid, traceId }) {
    const read = async () => {
      const fromCache = await this.repository.cached(collection, key, initial.version);
      const restored = fromCache && validate(fromCache.modelOutput, initial);
      if (restored) return { source: initial, output: restored, generatedAt: fromCache.generatedAt, cached: true };
      const result = await this.gateway.generate({
        ...task(input, initial), takeAttempt: () => this.repository.takeAttempt(uid), traceId,
      });
      if (!result.value) return { source: initial, failure: result.failure };
      const latest = await refresh();
      if (latest.version !== initial.version) return { source: latest, failure: 'SOURCE_CHANGED' };
      const accepted = validate(result.value, latest);
      if (!accepted) return { source: latest, failure: 'AI_OUTPUT_INVALID' };
      const generatedAt = await this.repository.save(collection, key, latest.version, result.value, ttl[collection]);
      return { source: latest, output: accepted, generatedAt, cached: false, usage: result.usage };
    };
    const jobKey = collection + ':' + key + ':' + initial.version;
    if (this.inflight.has(jobKey)) return this.inflight.get(jobKey);
    const job = read();
    this.inflight.set(jobKey, job);
    try { return await job; } finally { this.inflight.delete(jobKey); }
  }

  async menu(uid, input, traceId) {
    await this.repository.request(uid);
    const refresh = async () => {
      const source = await this.repository.menu(input);
      return { ...source, plans: menuPlans(source.foods, input) };
    };
    const initial = await refresh();
    const key = digest(['menu-v2', this.gateway.config.identity, uid, input]);
    const model = initial.plans.length ? await this.generate({
      collection: 'aiMenuCache', key, input, initial, refresh, uid, traceId,
      validate: (raw, source) => {
        const plan = source.plans.find(item => item.planId === raw?.planId);
        return plan && pricedMenu({ suggestions: plan.lines.map(line => ({ ...line, reason: raw.reason })) }, source.foods, input);
      },
      task: (values, source) => ({ kind: 'menu', instructions: menuInstructions,
        schema: menuSelectionSchema(source.plans.map(plan => plan.planId)), data: menuPrompt(values, source.plans) }),
    }) : { source: initial, failure: 'NO_MATCH' };
    const { output, source } = model;
    const menu = output ?? fallbackMenu(source.foods, input);
    const explanation = menu.suggestions.length ? 'Tổng tiền món và tùy chọn, chưa gồm phí giao.' :
      'Chưa tìm thấy tổ hợp đủ suất trong tập món đã kiểm tra và ngân sách đã chọn.';
    return { ...menu, explanation, currency: 'VND', shopId: input.shopId, diners: input.diners,
      generatedBy: output ? 'MODEL' : 'FALLBACK', fallbackReason: model.failure ?? null,
      sourceRevision: source.version, quotedAt: model.generatedAt ?? new Date(this.clock()).toISOString(),
      sampled: source.sampled, cached: model.cached === true, usage: model.usage ?? null, traceId };
  }

  async reviews(uid, input, traceId) {
    await this.repository.authorizeReview(uid, input.shopId);
    const interval = reviewInterval(input, this.clock());
    await this.repository.request(uid);
    const refresh = () => this.repository.reviews(uid, input.shopId, interval);
    const initial = await refresh();
    hasReviews(initial);
    // Keep cache and in-flight work scoped to the requesting authorized account.
    const key = digest(['reviews-v2', this.gateway.config.identity, uid, input.shopId, interval]);
    const model = await this.generate({
      collection: 'aiInsightCache', key, input, initial, refresh, uid, traceId,
      validate: (raw, source) => selectedReviewInsight(raw, source.reviews),
      task: (_values, source) => {
        const data = reviewPrompt(source.reviews);
        const schema = reviewSelectionSchema(data.reviews.flatMap(review => review.focusIds));
        return { kind: 'reviews', instructions: reviewInstructions, schema, data };
      },
    });
    await this.repository.authorizeReview(uid, input.shopId);
    const { source, output } = model;
    hasReviews(source);
    const insight = output ?? buildReviewInsight(source.reviews);
    const sampleSize = source.reviews.length;
    const fixtureCount = source.reviews.filter(review => review.fixture).length;
    const average = source.reviews.reduce((sum, review) => sum + review.rating, 0) / sampleSize;
    const summary = `Mẫu có ${sampleSize} đánh giá, trung bình ${average.toFixed(1)} sao.`;
    return { ...insight, summary, shopId: input.shopId, interval, sampleSize, sampled: source.sampled,
      fixtureCount, totalMatched: null, generatedBy: output ? 'MODEL' : 'FALLBACK',
      fallbackReason: model.failure ?? null, generatedAt: model.generatedAt ?? new Date(this.clock()).toISOString(),
      cached: model.cached === true, usage: model.usage ?? null, traceId };
  }
}
