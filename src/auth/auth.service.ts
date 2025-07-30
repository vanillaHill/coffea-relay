/* eslint-disable @typescript-eslint/no-unused-vars */

// ===============================
// DATABASE SERVICE - AUTH SERVICE
// ===============================

// src/database/auth/auth.service.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

export interface ServiceCredentials {
  serviceId: string;
  serviceSecret: string;
}

export interface JwtPayload {
  sub: string;
  serviceId: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly validServices: Map<string, string> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    // Initialize valid service credentials from environment
    this.initializeServiceCredentials();
  }

  private initializeServiceCredentials() {
    // Load service credentials from environment variables
    const services = {
      "ai-service": this.configService.get("AI_SERVICE_SECRET"),
    };

    Object.entries(services).forEach(([serviceId, secret]) => {
      if (secret) {
        this.validServices.set(serviceId, secret);
      }
    });

    // Log registered services for debugging
    console.log("Registered services:", Array.from(this.validServices.keys()));
  }

  async authenticateService(credentials: ServiceCredentials): Promise<string> {
    const { serviceId, serviceSecret } = credentials;

    // Verify service credentials
    const validSecret = this.validServices.get(serviceId);
    console.log(
      `Auth attempt - Service: ${serviceId}, Secret provided: ${serviceSecret}, Valid secret: ${validSecret}`
    );

    if (!validSecret || validSecret !== serviceSecret) {
      throw new UnauthorizedException("Invalid service credentials");
    }

    // Generate JWT token for the service
    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: serviceId,
      serviceId,
    };

    return this.jwtService.sign(payload);
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  // Generate a temporary access token (for development/testing)
  generateServiceToken(serviceId: string): string {
    if (!this.validServices.has(serviceId)) {
      throw new Error(`Service ${serviceId} not registered`);
    }

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: serviceId,
      serviceId,
    };

    return this.jwtService.sign(payload);
  }
}
