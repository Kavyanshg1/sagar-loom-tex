import logo from "../assets/logo.png";

const authModes = [
  { key: "login", label: "Login" },
  { key: "signup", label: "Sign Up" },
];

export function AuthScreen({
  mode,
  onModeChange,
  values,
  onChange,
  onSubmit,
  loading,
  error,
  userCount,
}) {
  const isFirstUser = userCount === 0;

  return (
    <div className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-[36px] bg-ink px-6 py-8 text-white shadow-float sm:px-10">
          <div className="flex items-center">
            <img
              src={logo}
              alt="Sagar Loom Tex Logo"
              className="mr-4 h-12 w-auto object-contain sm:h-14"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                SAGAR LOOM TEX
              </h1>
              <p className="mt-1 text-sm text-blue-200 sm:text-base">
                Textile Production Flow Dashboard
              </p>
            </div>
          </div>

          <div className="mt-10 max-w-xl">
            <div className="rounded-[30px] border border-white/10 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                Secure Operations
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-white">
                Run yarn, processing, dyeing, and direct-transfer operations under one protected
                workspace.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Sign in to access production records, PDF exports, AI-assisted uploads, and admin
                controls. Manual entry remains unchanged once you are inside.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-slate-200">Protected data</div>
                <div className="mt-2 text-sm text-slate-300">
                  Records and admin actions now require account access.
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-slate-200">Persistent storage</div>
                <div className="mt-2 text-sm text-slate-300">
                  Hosted deployments can point to a mounted data volume safely.
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold text-slate-200">Admin controls</div>
                <div className="mt-2 text-sm text-slate-300">
                  The first account is created as admin for setup and reset actions.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[36px] border border-slate-200 bg-white p-6 shadow-float sm:p-8">
            <div className="flex gap-3 rounded-2xl bg-slate-100 p-1">
              {authModes.map((authMode) => (
                <button
                  key={authMode.key}
                  type="button"
                  onClick={() => onModeChange(authMode.key)}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    mode === authMode.key
                      ? "bg-white text-ink shadow-sm"
                      : "text-slate-500 hover:text-ink"
                  }`}
                >
                  {authMode.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-2xl font-bold text-ink">
                {mode === "login" ? "Welcome back" : "Create your workspace login"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {mode === "login"
                  ? "Sign in to continue to the SAGAR LOOM TEX dashboard."
                  : isFirstUser
                    ? "Create the first account to bootstrap the admin workspace."
                    : "Add another authenticated user for the hosted dashboard."}
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {mode === "signup" ? (
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  <span>Full Name</span>
                  <input
                    type="text"
                    name="name"
                    value={values.name}
                    onChange={onChange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                    placeholder="Sagar Admin"
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Email Address</span>
                <input
                  type="email"
                  name="email"
                  value={values.email}
                  onChange={onChange}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                  placeholder="you@company.com"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  value={values.password}
                  onChange={onChange}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                  placeholder="At least 8 characters"
                />
              </label>

              {mode === "signup" ? (
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  <span>Confirm Password</span>
                  <input
                    type="password"
                    name="confirm_password"
                    value={values.confirm_password}
                    onChange={onChange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                    placeholder="Repeat your password"
                  />
                </label>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                    ? "Login"
                    : "Create Account"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
