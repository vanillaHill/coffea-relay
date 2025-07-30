// ===============================
// DATABASE SERVICE - AUTH CONTROLLER
// ===============================

// src/database/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AuthService, ServiceCredentials } from "./auth.service";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post("token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get service access token" })
  async getToken(@Body() credentials: ServiceCredentials) {
    this.logger.log(`Token request received: ${JSON.stringify(credentials)}`);
    const token = await this.authService.authenticateService(credentials);
    return {
      access_token: token,
      token_type: "Bearer",
      expires_in: 86400, // 24 hours
    };
  }
}
