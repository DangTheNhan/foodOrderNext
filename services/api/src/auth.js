import { uidSchema, roleSchema } from '@foodordernext/contracts';
import { ApiError, requireValidProfile } from './errors.js';

export function authenticate(verifyIdToken) {
  return async (req, _res, next) => {
    const header = req.get('authorization');
    if (!header) return next(new ApiError(401, 'AUTH_REQUIRED', 'Cần đăng nhập.'));
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match || match[1].length > 8192) return next(new ApiError(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ.'));
    try {
      const decoded = await verifyIdToken(match[1]);
      if (!uidSchema.safeParse(decoded?.uid).success) throw new Error('Invalid UID');
      req.identity = { uid: decoded.uid, email: typeof decoded.email === 'string' ? decoded.email : null, name: typeof decoded.name === 'string' ? decoded.name : null, emailVerified: decoded.email_verified === true };
      next();
    } catch (error) {
      const unavailable = ['auth/internal-error', 'app/network-error', 'auth/network-request-failed'].includes(error.code);
      next(new ApiError(unavailable ? 503 : 401, unavailable ? 'AUTH_SERVICE_UNAVAILABLE' : 'TOKEN_INVALID', unavailable ? 'Chưa thể xác minh phiên đăng nhập.' : 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
    }
  };
}

export function requireActiveUser(userRepository) {
  return async (req, _res, next) => {
    try {
      req.profile = requireValidProfile(await userRepository.findByUid(req.identity.uid));
      if (!roleSchema.safeParse(req.profile.role).success) throw new ApiError(503, 'PROFILE_INVALID', 'Hồ sơ cần được kiểm tra.');
      next();
    } catch (error) { next(error); }
  };
}

export function requireVerifiedEmail(req, _res, next) {
  if (!req.identity.emailVerified) return next(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Cần xác minh email trước thao tác này.'));
  next();
}

export function requireRoles(...roles) {
  if (roles.some(role => !roleSchema.safeParse(role).success)) throw new Error('Unknown role in authorization policy');
  return (req, _res, next) => {
    if (!req.profile?.active || !roles.includes(req.profile.role)) return next(new ApiError(403, 'FORBIDDEN', 'Không có quyền thực hiện.'));
    next();
  };
}

export function assertShopOwner(actor, shop) {
  if (!actor?.profile?.active || !shop || !(actor.profile.role === 'admin' || (actor.profile.role === 'merchant' && shop.ownerUid === actor.uid))) throw new ApiError(403, 'FORBIDDEN', 'Không có quyền quản lý quán.');
}

export function assertAssignedDriver(actor, order, approval) {
  if (!actor?.profile?.active || actor.profile.role !== 'driver' || order?.driverUid !== actor.uid || !approval?.active || !approval?.approved) throw new ApiError(403, 'DRIVER_NOT_ASSIGNED', 'Không có quyền xử lý chuyến này.');
}
