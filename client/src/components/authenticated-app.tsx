import { type User } from "stream-chat";

interface AuthenticatedAppProps {
    user: User;
    onLogout: () => void;
}

const AuthenticatedApp = () => {
  return <div>Authenticated App</div>;
};

export default AuthenticatedApp;
