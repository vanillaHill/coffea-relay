/* eslint-disable @typescript-eslint/no-explicit-any */

// ===============================
// BACKEND SERVICE - DATABASE CLIENT
// ===============================

// backend/src/database/database.client.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseAuthClient } from "../auth/database-auth.client";

@Injectable()
export class DatabaseClient {
  private readonly logger = new Logger(DatabaseClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly authClient: DatabaseAuthClient,
    private readonly configService: ConfigService
  ) {
    this.baseUrl =
      this.configService.get<string>("DATABASE_SERVICE_URL") + "/api/v1";
  }

  // ================================
  // USER OPERATIONS
  // ================================
  async getUserByWallet(walletAddress: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/users/${walletAddress}`
    );
  }

  async createUser(walletAddress: string) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/users`,
      { walletAddress }
    );
  }

  // ================================
  // PROFILE OPERATIONS
  // ================================
  async getUserProfile(userId: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/profiles/${userId}`
    );
  }

  async createUserProfile(userId: string, profileData: any) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/profiles`,
      { userId, ...profileData }
    );
  }

  async updateUserProfile(userId: string, updates: any) {
    return this.authClient.makeAuthenticatedRequest(
      "PUT",
      `${this.baseUrl}/profiles/${userId}`,
      updates
    );
  }

  // ================================
  // STRATEGY OPERATIONS
  // ================================
  async getExecutionLogsByWallet(walletAddress: string, limit?: number) {
    const url = `${this.baseUrl}/execution-logs/${walletAddress}${limit ? `?limit=${limit}` : ""}`;
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  async createStrategy(strategyData: any) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/strategies`,
      strategyData
    );
  }

  async logStrategy(logData: any) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/strategies/log`,
      logData
    );
  }

  // ================================
  // USER STRATEGY OPERATIONS
  // ================================
  async createUserStrategy(strategyData: any) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/user-strategies`,
      strategyData
    );
  }

  async getUserStrategies(walletAddress: string, limit?: number) {
    const url = `${this.baseUrl}/user-strategies/${walletAddress}${limit ? `?limit=${limit}` : ""}`;
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  async getUserStrategyById(strategyId: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/user-strategies/strategy/${strategyId}`
    );
  }

  // ================================
  // TOKEN METADATA OPERATIONS
  // ================================

  async getActiveTokens() {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/tokens/active`
    );
  }

  async getAllActiveTokens(chainId?: number) {
    const url = `${this.baseUrl}/tokens/all${chainId ? `?chainId=${chainId}` : ""}`;
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  async getAllTokenTypes() {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/tokens/types`
    );
  }

  async getTokensForAsset(assetSymbol: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/tokens/asset/${assetSymbol}`
    );
  }

  async getTokensByRiskLevel(riskLevel: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/tokens/risk/${riskLevel}`
    );
  }

  async getTokensByChain(chainId: number) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/tokens/chain/${chainId}`
    );
  }

  async getTokensByProtocol(protocolName: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/tokens/protocol/${protocolName}`
    );
  }

  async updateTokenApy(tokenAddress: string, chainId: number, apy: number) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/tokens/${tokenAddress}/${chainId}/apy`,
      { apy }
    );
  }

  async updateTokenStatus(
    tokenAddress: string,
    chainId: number,
    active: boolean
  ) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/tokens/${tokenAddress}/${chainId}/status`,
      { active }
    );
  }

  // ================================
  // RELAY TASK OPERATIONS
  // ================================
  async createRelayTask(dto: any) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/relay-tasks`,
      dto
    );
  }

  async getRelayTask(taskId: string) {
    return this.authClient.makeAuthenticatedRequest(
      "GET",
      `${this.baseUrl}/relay-tasks/${taskId}`
    );
  }

  async getRelayTasksByUser(
    user: string, 
    limit?: number, 
    offset?: number,
    orderBy?: string,
    orderDirection?: 'ASC' | 'DESC'
  ) {
    let url = `${this.baseUrl}/relay-tasks/user/${user}`;
    const params = [];
    if (limit) params.push(`limit=${limit}`);
    if (offset) params.push(`offset=${offset}`);
    if (orderBy) params.push(`orderBy=${orderBy}`);
    if (orderDirection) params.push(`orderDirection=${orderDirection}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  async getRelayTasksByChainAndStatus(chainId: number, status: string, limit?: number) {
    let url = `${this.baseUrl}/relay-tasks/chain/${chainId}/status/${status}`;
    if (limit) url += `?limit=${limit}`;
    
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  async updateRelayTask(taskId: string, updates: any) {
    return this.authClient.makeAuthenticatedRequest(
      "PUT",
      `${this.baseUrl}/relay-tasks/${taskId}`,
      updates
    );
  }

  async getPendingRelayTasks(chainId?: number) {
    let url = `${this.baseUrl}/relay-tasks/pending`;
    if (chainId) url += `?chainId=${chainId}`;
    
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  async getRelayTaskStats(user?: string) {
    let url = `${this.baseUrl}/relay-tasks/stats`;
    if (user) url += `?user=${user}`;
    
    return this.authClient.makeAuthenticatedRequest("GET", url);
  }

  // ================================
  // CACHE OPERATIONS
  // ================================
  async clearCache(pattern: string) {
    return this.authClient.makeAuthenticatedRequest(
      "POST",
      `${this.baseUrl}/cache/clear/${pattern}`,
      {}
    );
  }

  // ================================
  // OBSOLETE PROTOCOL OPERATIONS - REMOVED
  // ================================
  // The following methods have been removed as they are replaced by token metadata:
  //
  // async getActiveProtocols() - replaced by getActiveTokens()
  // async getProtocolsForToken() - replaced by getTokensForAsset()
  // async getProtocolsForRiskLevel() - replaced by getTokensByRiskLevel()
  // async getProtocolsByChain() - replaced by getTokensByChain()
  // async getProtocolByName() - replaced by getTokensByProtocol()
  // async updateProtocolStatus() - replaced by updateTokenStatus()
  // async updateProtocolConfidence() - now part of token metadata
  // async updateProtocolApy() - replaced by updateTokenApy()
  //
  // These protocol-centric methods are no longer needed in the token-centric architecture.
}
