import { useMutation } from "@tanstack/react-query";
import { loginUser } from "@/lib/Api";
import { useAuth } from "@/lib/AuthContext";

export const useLogin = () => {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      localStorage.setItem("access", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
    },
  });
};
