import type { Request } from "express";

export const registerCoreRoutes = (deps: {
  app: any;
  adminStateReady: Promise<void>;
  adminState: any;
  generateUserUid: () => string;
  sha256: (text: string) => string;
  addAdminLog: (...args: any[]) => void;
  persistAdminState: () => Promise<void>;
  issuePlayerToken: (user: any) => string;
  PLAYER_TOKEN_TTL_SECONDS: number;
  buildAuthUserResponse: (user: any) => any;
  requirePlayer: any;
  readPromptFile: (fn: any, role: any) => Promise<string>;
  FUNCTION_TYPES: string[];
  getModelsUrl: (provider: any, endpoint: string) => string;
  PROVIDER_DEFAULT_ENDPOINTS: Record<string, string>;
  buildAuthHeaders: (provider: any, apiKey: string) => Record<string, string>;
}) => {
  const { app, requirePlayer } = deps;

  app.get("/api/health", (_req: any, res: any) => {
    res.json({ status: "ok" });
  });

  app.get("/api/scripts", async (_req: any, res: any) => {
    await deps.adminStateReady;
    const scripts = deps.adminState.scripts
      .filter((script: any) => script.isPublished)
      .map((script: any) => ({
        id: script.id,
        title: script.title,
        description: script.description,
        tags: script.tags,
        content: script.content,
        settingPrompt: script.settingPrompt,
        finalGoal: script.finalGoal,
        opening: script.opening,
        roleTemplates: script.roleTemplates
      }));
    res.json({ scripts });
  });

  app.post("/api/auth/register", async (req: any, res: any) => {
    await deps.adminStateReady;
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username) return res.status(400).json({ error: "用户名不能为空" });
    if (!password) return res.status(400).json({ error: "密码不能为空" });
    if (deps.adminState.users.some((user: any) => user.username === username)) {
      return res.status(400).json({ error: "用户名已存在" });
    }

    const now = Date.now();
    const user = {
      uid: deps.generateUserUid(),
      username,
      password: deps.sha256(password),
      createdAt: now,
      status: "active",
      role: "player",
      lastLoginAt: now
    };
    deps.adminState.users.push(user);
    deps.addAdminLog("system", "register_user", "user", username);
    await deps.persistAdminState();
    res.json({ token: deps.issuePlayerToken(user), expiresIn: deps.PLAYER_TOKEN_TTL_SECONDS, user: deps.buildAuthUserResponse(user) });
  });

  app.post("/api/auth/login", async (req: any, res: any) => {
    await deps.adminStateReady;
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) return res.status(400).json({ error: "请输入用户名和密码" });
    const user = deps.adminState.users.find((item: any) => item.username === username);
    if (!user || user.password !== deps.sha256(password)) return res.status(401).json({ error: "用户名或密码错误" });
    if (user.status === "disabled") return res.status(403).json({ error: "该账号已被禁用" });

    user.lastLoginAt = Date.now();
    deps.addAdminLog(username, "player_login", "user", username);
    await deps.persistAdminState();
    res.json({ token: deps.issuePlayerToken(user), expiresIn: deps.PLAYER_TOKEN_TTL_SECONDS, user: deps.buildAuthUserResponse(user) });
  });

  app.get("/api/auth/me", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    res.json({ user: deps.buildAuthUserResponse(user) });
  });

  app.post("/api/auth/change-password", requirePlayer, async (req: Request, res: any) => {
    await deps.adminStateReady;
    const user = (req as Request & { playerUser: any }).playerUser;
    const oldPassword = String((req as any).body?.oldPassword || "");
    const newPassword = String((req as any).body?.newPassword || "");
    if (!oldPassword || !newPassword) return res.status(400).json({ error: "请输入旧密码和新密码" });
    if (newPassword.length < 6) return res.status(400).json({ error: "新密码长度至少 6 位" });
    if (deps.sha256(oldPassword) !== user.password) return res.status(400).json({ error: "旧密码错误" });

    user.password = deps.sha256(newPassword);
    deps.addAdminLog(user.username, "change_password", "user", user.username);
    await deps.persistAdminState();
    res.json({ ok: true });
  });

  app.get("/api/prompts/defaults", async (_req: any, res: any) => {
    const data: Record<string, Record<string, string>> = {
      actionCollector: { system: "", user: "", model: "" },
      mainStory: { system: "", user: "", model: "" },
      stateProcessor: { system: "", user: "", model: "" }
    };
    for (const fn of deps.FUNCTION_TYPES) {
      data[fn].system = await deps.readPromptFile(fn, "system");
      data[fn].user = await deps.readPromptFile(fn, "user");
      data[fn].model = await deps.readPromptFile(fn, "model");
    }
    res.json(data);
  });

  app.post("/api/models", async (req: any, res: any) => {
    const provider = String(req.body?.provider || "openaiCompatible");
    const endpointInput = String(req.body?.endpoint || "").trim();
    const apiKey = String(req.body?.apiKey || "");
    const endpoint = endpointInput || deps.PROVIDER_DEFAULT_ENDPOINTS[provider] || "";
    if (!endpoint) return res.status(400).json({ error: "endpoint is required" });

    try {
      if (provider === "gemini") {
        const response = await fetch(deps.getModelsUrl("gemini", endpoint), { method: "GET", headers: { ...deps.buildAuthHeaders("gemini", apiKey) } });
        if (!response.ok) return res.status(response.status).json({ error: (await response.text()) || "获取Gemini模型失败" });
        const payload = await response.json() as any;
        const rawList = Array.isArray(payload?.models) ? payload.models : [];
        const models = rawList.map((m: any) => ({ id: String(m.name || "").replace(/^models\//, ""), name: String(m.displayName || m.name || "") })).filter((m: { id: string }) => m.id);
        return res.json({ models });
      }

      const response = await fetch(deps.getModelsUrl(provider, endpoint), { method: "GET", headers: { ...deps.buildAuthHeaders(provider, apiKey) } });
      if (!response.ok) return res.status(response.status).json({ error: (await response.text()) || "获取模型失败" });
      const payload = await response.json() as any;
      const rawList = Array.isArray(payload?.data) ? payload.data : [];
      const models = rawList.map((m: any) => ({ id: String(m.id || m.name || ""), name: String(m.display_name || m.id || m.name || "") })).filter((m: { id: string }) => m.id);
      res.json({ models });
    } catch (error) {
      res.status(500).json({ error: `模型获取异常: ${String((error as Error)?.message ?? error)}` });
    }
  });
};
