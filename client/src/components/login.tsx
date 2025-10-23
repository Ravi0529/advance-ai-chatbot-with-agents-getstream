import { type User } from "stream-chat";

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  return <div>Login Page</div>;
};

export default Login;
