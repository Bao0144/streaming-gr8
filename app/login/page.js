import LoginForm from "components/login-form";
import { listDemoUsers } from "lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await listDemoUsers();

  return (
    <main className="page-shell login-page-shell">
      <section className="login-card">
        <div className="login-copy">
          <p className="section-kicker">Demo access</p>
          <h1 className="login-title">Đăng nhập vào streaming dashboard</h1>
          <p className="login-subtitle">
            Hệ thống demo dùng tài khoản có sẵn trong database. Nhập đúng username và mật khẩu để truy cập dashboard, studio và stream của user đó.
          </p>
        </div>

        <LoginForm users={users} />

        <div className="login-users">
          {users.map((user) => (
            <div className="login-user-chip" key={user.id}>
              <strong>{user.displayName}</strong>
              <span>{user.username}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
