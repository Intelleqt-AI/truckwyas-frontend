import { useMutation } from "@tanstack/react-query";
import { loginUser } from "@/lib/Api";
import { useAuth } from "@/lib/AuthContext";

export const useLogin = () => {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // A 2FA response has no token yet (it carries `otp_required` + a
      // pending_token instead) — only persist once we actually get a token.
      if (data?.token) {
        localStorage.setItem("access", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      }
    },
  });
};
