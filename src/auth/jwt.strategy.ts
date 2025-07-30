// ===============================
// DATABASE SERVICE - JWT STRATEGY
// ===============================

// src/database/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
export interface JwtPayload {
  sub: string;
  serviceId: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("JWT_SECRET") || "default-secret-key",
    });
  }

  async validate(payload: JwtPayload) {
    this.logger.debug(
      `Validating JWT payload for service: ${payload.serviceId}`
    );

    if (!payload.serviceId || !payload.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    return {
      userId: payload.sub,
      serviceId: payload.serviceId,
    };
  }
}
