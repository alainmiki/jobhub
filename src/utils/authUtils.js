export const handleAuthResponse = (res, authResponse) => {
  if (authResponse?.headers) {
    authResponse.headers.forEach((value, key) => {
      res.append(key, value);
    });
  }
  return authResponse;
};

export const handleAuthError = (res, error, defaultMessage = 'An error occurred') => {
  const message = error?.response?.data?.message || error?.message || defaultMessage;
  return { error: message, message };
};

export const createAuthHandler = (auth) => ({
  async signInEmail(body, headers, res) {
    const response = await auth.api.signInEmail({
      body,
      headers,
      asResponse: true
    });
    handleAuthResponse(res, response);
    return response;
  },

  async signUpEmail(body, headers, res) {
    const response = await auth.api.signUpEmail({
      body,
      headers,
      asResponse: true
    });
    handleAuthResponse(res, response);
    return response;
  },

  async signOut(headers, res) {
    const response = await auth.api.signOut({
      headers,
      asResponse: true
    });
    handleAuthResponse(res, response);
    return response;
  },

  async resetPassword(body, headers, res) {
    const response = await auth.api.resetPassword({
      body,
      headers,
      asResponse: true
    });
    handleAuthResponse(res, response);
    return response;
  },

  async verifyEmail(query, headers, res) {
    const response = await auth.api.verifyEmail({
      query,
      headers,
      asResponse: true
    });
    handleAuthResponse(res, response);
    return response;
  },

  async changePassword(body, headers, res) {
    const response = await auth.api.changePassword({
      body,
      headers,
      asResponse: true
    });
    handleAuthResponse(res, response);
    return response;
  }
});