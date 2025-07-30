 
 
// ===============================
// BACKEND SERVICE - AUTH CLIENT
// ===============================

// backend/src/auth/database-auth.client.ts
import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

@Injectable()
export class DatabaseAuthClient {
  private readonly logger = new Logger(DatabaseAuthClient.name);
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(): Promise<string> {
    // Check if current token is still valid
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    // Obtain new token
    await this.refreshToken();
    return this.token;
  }

  private async refreshToken(): Promise<void> {
    try {
      const databaseServiceUrl = this.configService.get<string>(
        "DATABASE_SERVICE_URL",
      );
      const serviceId = this.configService.get<string>(
        "SERVICE_ID",
        "backend-api",
      );
      const serviceSecret = this.configService.get<string>(
        "DATABASE_SERVICE_SECRET",
      );

      if (!serviceSecret) {
        throw new Error("DATABASE_SERVICE_SECRET not configured");
      }

      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          `${databaseServiceUrl}/auth/token`,
          {
            serviceId,
            serviceSecret,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 5000,
          },
        ),
      );

      this.token = response.data.access_token;

      // Set expiry time (subtract 5 minutes for safety)
      const expirySeconds = response.data.expires_in - 300;
      this.tokenExpiry = new Date(Date.now() + expirySeconds * 1000);

      this.logger.log("Successfully obtained database service token");
    } catch (error) {
      this.logger.error(
        "Failed to obtain database service token:",
        error.message,
      );
      throw new Error("Authentication with database service failed");
    }
  }

  async makeAuthenticatedRequest<T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    data?: any,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    };

    try {
      let response;
      switch (method) {
        case "GET":
          response = await firstValueFrom(this.httpService.get(url, config));
          break;
        case "POST":
          response = await firstValueFrom(
            this.httpService.post(url, data, config),
          );
          break;
        case "PUT":
          response = await firstValueFrom(
            this.httpService.put(url, data, config),
          );
          break;
        case "DELETE":
          response = await firstValueFrom(this.httpService.delete(url, config));
          break;
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token might be expired, clear it and retry once
        this.token = null;
        this.tokenExpiry = null;

        const newToken = await this.getAccessToken();
        config.headers.Authorization = `Bearer ${newToken}`;

        // Retry the request
        let retryResponse;
        switch (method) {
          case "GET":
            retryResponse = await firstValueFrom(
              this.httpService.get(url, config),
            );
            break;
          case "POST":
            retryResponse = await firstValueFrom(
              this.httpService.post(url, data, config),
            );
            break;
          case "PUT":
            retryResponse = await firstValueFrom(
              this.httpService.put(url, data, config),
            );
            break;
          case "DELETE":
            retryResponse = await firstValueFrom(
              this.httpService.delete(url, config),
            );
            break;
        }

        return retryResponse.data;
      }

      throw error;
    }
  }
}
