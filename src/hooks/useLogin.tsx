import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUser } from "@/lib/Api";
import { useAuth } from "@/lib/AuthContext";

export const useLogin = () => {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // A 2FA response has no token yet (it carries `otp_required` + a
      // pending_token instead) — only persist once we actually get a token.
      if (data?.token) {
        // Drop any cached data from a previous account on this browser —
        // query keys carry no user id, so stale cross-account data would
        // otherwise render for up to staleTime after switching accounts.
        queryClient.clear();
        localStorage.setItem("access", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      }
    },
  });
};
