// hooks/useLogin.ts
import { useMutation } from "@tanstack/react-query";
import { loginUser } from "@/lib/Api";

export const useLogin = () => {
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Save tokens and user data
      localStorage.setItem("access", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    },
  });
};
