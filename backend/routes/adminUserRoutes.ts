import type { Request } from "express";

export const registerAdminUserRoutes = (deps: {
  app: any;
  requireAdmin: any;
  adminStateReady: Promise<void>;
  adminState: any;
  rooms: Record<string, any>;
  getActivePlayers: (room: any) => Array<any>;
  sha256: (text: string) => string;
  addAdminLog: (...args: any[]) => void;
  persistAdminState: () => Promise<void>;
  issueAdminToken: (username: string) => string;
  ADMIN_TOKEN_TTL_SECONDS: number;
  buildAuthUserResponse: (user: any) => any;
}) => {
  const { app, requireAdmin } = deps;

  app.post("/api/admin/login", async (req: any, res: any) => {
    await deps.adminStateReady;
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) return res.status(400).json({ error: "请输入用户名和密码" });

    const user = deps.adminState.users.find((item: any) => item.username === username && item.role === "moderator");
    if (!user || user.password !== deps.sha256(password)) return res.status(401).json({ error: "用户名或密码错误" });
    if (user.status === "disabled") return res.status(403).json({ error: "该管理员账户已被禁用" });

    user.lastLoginAt = Date.now();
    deps.addAdminLog(user.username, "admin_login", "system", user.username);
    await deps.persistAdminState();
    res.json({
      token: deps.issueAdminToken(user.username),
      expiresIn: deps.ADMIN_TOKEN_TTL_SECONDS,
      user: deps.buildAuthUserResponse(user)
    });
  });

  app.get("/api/admin/me", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { adminUser: any }).adminUser;
    res.json({ user: deps.buildAuthUserResponse(user) });
  });

  app.get("/api/admin/dashboard", requireAdmin, async (_req: any, res: any) => {
    await deps.adminStateReady;
    const allRooms = Object.values(deps.rooms);
    const activeRooms = allRooms.filter((room: any) => deps.getActivePlayers(room).length > 0);
    res.json({
      users: {
        total: deps.adminState.users.length,
        active: deps.adminState.users.filter((user: any) => user.status === "active").length,
        disabled: deps.adminState.users.filter((user: any) => user.status === "disabled").length,
        moderators: deps.adminState.users.filter((user: any) => user.role === "moderator").length
      },
      scripts: {
        total: deps.adminState.scripts.length,
        published: deps.adminState.scripts.filter((script: any) => script.isPublished).length,
        builtin: deps.adminState.scripts.filter((script: any) => script.source === "builtin").length,
        custom: deps.adminState.scripts.filter((script: any) => script.source === "admin").length
      },
      rooms: {
        total: allRooms.length,
        active: activeRooms.length,
        waiting: allRooms.filter((room: any) => room.status === "waiting").length,
        processing: allRooms.filter((room: any) => room.status !== "waiting").length,
        onlinePlayers: allRooms.reduce((count: number, room: any) => count + deps.getActivePlayers(room).length, 0)
      },
      recentLogs: deps.adminState.logs.slice(0, 10)
    });
  });

  app.get("/api/admin/users", requireAdmin, async (req: any, res: any) => {
    await deps.adminStateReady;
    const query = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();
    const role = String(req.query.role || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));

    let list = [...deps.adminState.users];
    if (query) list = list.filter((user: any) => user.username.toLowerCase().includes(query) || user.uid.toLowerCase().includes(query));
    if (status === "active" || status === "disabled") list = list.filter((user: any) => user.status === status);
    if (role === "player" || role === "moderator") list = list.filter((user: any) => user.role === role);
    list.sort((a: any, b: any) => b.createdAt - a.createdAt);

    const total = list.length;
    const start = (page - 1) * pageSize;
    res.json({ rows: list.slice(start, start + pageSize).map(deps.buildAuthUserResponse), total, page, pageSize });
  });

  app.patch("/api/admin/users/:username", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const username = String((req as any).params.username || "").trim();
    const target = deps.adminState.users.find((user: any) => user.username === username);
    if (!target) return res.status(404).json({ error: "用户不存在" });

    const nextStatus = (req as any).body?.status;
    const nextRole = (req as any).body?.role;
    const nextPassword = typeof (req as any).body?.password === "string" ? (req as any).body.password : "";
    if (nextStatus && nextStatus !== "active" && nextStatus !== "disabled") return res.status(400).json({ error: "status 参数无效" });
    if (nextRole && nextRole !== "player" && nextRole !== "moderator") return res.status(400).json({ error: "role 参数无效" });
    if (target.username === operator.username && nextStatus === "disabled") return res.status(400).json({ error: "不能禁用当前登录管理员" });
    if (target.username === operator.username && nextRole === "player") return res.status(400).json({ error: "不能降级当前登录管理员" });
    if (nextStatus) target.status = nextStatus;
    if (nextRole) target.role = nextRole;
    if (nextPassword) {
      if (nextPassword.length < 6) return res.status(400).json({ error: "新密码长度至少 6 位" });
      target.password = deps.sha256(nextPassword);
    }

    deps.addAdminLog(operator.username, "update_user", "user", target.username, {
      status: target.status,
      role: target.role,
      passwordReset: Boolean(nextPassword)
    });
    await deps.persistAdminState();
    res.json({ user: deps.buildAuthUserResponse(target) });
  });

  app.delete("/api/admin/users/:username", requireAdmin, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const operator = (req as Request & { adminUser: any }).adminUser;
    const username = String((req as any).params.username || "").trim();
    const index = deps.adminState.users.findIndex((user: any) => user.username === username);
    if (index < 0) return res.status(404).json({ error: "用户不存在" });

    const target = deps.adminState.users[index];
    if (target.username === operator.username) return res.status(400).json({ error: "不能删除当前登录管理员" });
    if (target.role === "moderator") {
      const moderators = deps.adminState.users.filter((user: any) => user.role === "moderator");
      if (moderators.length <= 1) return res.status(400).json({ error: "至少需要保留一个管理员账号" });
    }

    deps.adminState.users.splice(index, 1);
    deps.addAdminLog(operator.username, "delete_user", "user", target.username, { uid: target.uid, role: target.role });
    await deps.persistAdminState();
    res.json({ ok: true });
  });
};

