export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(error) {
  return new ApiError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code, message: issue.code === 'unrecognized_keys' ? 'Trường không được phép.' : 'Giá trị không hợp lệ.' })));
}

export function requireValidProfile(profile) {
  if (!profile) throw new ApiError(403, 'PROFILE_NOT_FOUND', 'Cần khởi tạo hồ sơ.');
  if (profile.active !== true) throw new ApiError(403, 'USER_INACTIVE', 'Tài khoản đã bị khóa.');
  return profile;
}
