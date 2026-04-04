import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000"
});

// Helper functions for authentication

export const signUp = async (name: string, email: string, password: string, role: string = "candidate") => {
  const { data, error } = await authClient.signUp.email({
    name,
    email,
    password,
    callbackURL: "/dashboard"
  });

  if (error) {
    console.error("Sign up error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const signIn = async (email: string, password: string, rememberMe: boolean = true) => {
  const { data, error } = await authClient.signIn.email({
    email,
    password,
    rememberMe,
    callbackURL: "/dashboard"
  });

  if (error) {
    console.error("Sign in error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const signOut = async (redirectTo: string = "/sign-in") => {
  const { data, error } = await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = redirectTo;
      }
    }
  });

  if (error) {
    console.error("Sign out error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const getCurrentSession = async () => {
  const { data, error } = await authClient.getSession();
  
  if (error) {
    console.error("Get session error:", error.message);
    return { success: false, session: null, error };
  }

  return { success: true, session: data };
};

export const requestPasswordReset = async (email: string) => {
  const { data, error } = await authClient.requestPasswordReset({
    email,
    redirectTo: "/reset-password"
  });

  if (error) {
    console.error("Request password reset error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const resetPassword = async (newPassword: string, token: string) => {
  const { data, error } = await authClient.resetPassword({
    newPassword,
    token
  });

  if (error) {
    console.error("Reset password error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const changePassword = async (currentPassword: string, newPassword: string, revokeOtherSessions: boolean = true) => {
  const { data, error } = await authClient.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions
  });

  if (error) {
    console.error("Change password error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const updateUser = async (updates: { name?: string; image?: string }) => {
  const { data, error } = await authClient.updateUser(updates);

  if (error) {
    console.error("Update user error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

export const sendVerificationEmail = async (email: string) => {
  const { data, error } = await authClient.sendVerificationEmail({
    email,
    callbackURL: "/dashboard"
  });

  if (error) {
    console.error("Send verification email error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

// Hook for React components
export const useSession = () => {
  return authClient.useSession();
};

// List all sessions
export const listSessions = async () => {
  const { data, error } = await authClient.listSessions();
  
  if (error) {
    console.error("List sessions error:", error.message);
    return { success: false, sessions: [], error };
  }

  return { success: true, sessions: data };
};

// Revoke a specific session
export const revokeSession = async (token: string) => {
  const { data, error } = await authClient.revokeSession({ token });

  if (error) {
    console.error("Revoke session error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};

// Revoke all other sessions
export const revokeOtherSessions = async () => {
  const { data, error } = await authClient.revokeOtherSessions();

  if (error) {
    console.error("Revoke other sessions error:", error.message);
    return { success: false, error };
  }

  return { success: true, data };
};
