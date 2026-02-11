// hooks/useLogin.ts
import { useMutation } from "@tanstack/react-query";
import { loginUser } from "@/lib/Api";
import { tokenStorage } from "@/lib/tokenStorage";

export const useLogin = () => {
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Save tokens and user data in sessionStorage (not localStorage)
      tokenStorage.setToken(data.token);
      tokenStorage.setUser(data.user);
    },
  });
};
