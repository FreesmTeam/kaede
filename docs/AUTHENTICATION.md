# Authentication

## Scheme

```text
Microsoft OAuth2 -> Xbox Live (XBL) -> XSTS -> Minecraft Services -> Profile
access token        user token         token   access token          UUID,
refresh token                                  (24h JWT)             name,
                                                                     skins
```

The implementation is located in `src/lib/auth/`:

| Step                                       | File                                    |
|--------------------------------------------|-----------------------------------------|
| Localhost browser redirect                 | `scopes/authorize-interactively.ts`     |
| Microsoft code and refresh tokens          | `scopes/request-microsoft-tokens.ts`    |
| Xbox Live user token                       | `scopes/authenticate-with-xbox-live.ts` |
| XSTS authorization and `XErr` handling     | `scopes/authorize-with-xsts.ts`         |
| Minecraft Services token                   | `scopes/fetch-minecraft-token.ts`       |
| Profile (UUID, name, and skins)            | `scopes/fetch-minecraft-profile.ts`     |
| Interactive sign-in wrapper                | `scopes/sign-in-with-microsoft.ts`      |
| Silent token refresh before the launch     | `scopes/ensure-fresh-account.ts`        |
| Stored account into launch argument values | `scopes/build-launch-auth.ts`           |
