/**
 * Real-time Collaboration System for yq-sanyi
 * 
 * This module provides real-time collaboration capabilities including:
 * - Operational Transformation (OT) for conflict resolution
 * - Real-time state synchronization
 * - Presence management and user awareness
 * - Conflict detection and resolution
 * - Real-time cursors and selections
 * - Collaboration analytics and monitoring
 * - Offline support with conflict resolution
 * - Real-time events and notifications
 */

export interface CollaborationConfig {
  serverUrl?: string;
  roomId?: string;
  userId?: string;
  userName?: string;
  enableOffline?: boolean;
  conflictResolution?: 'last-write-wins' | 'operational-transform' | 'custom';
  syncInterval?: number;
  retryAttempts?: number;
  enableAnalytics?: boolean;
  enablePresence?: boolean;
  enableCursors?: boolean;
  enableSelections?: boolean;
}

export interface User {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  online: boolean;
  lastSeen: number;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
}

export interface CollaborationEvent {
  type: 'state-update' | 'user-joined' | 'user-left' | 'cursor-move' | 'selection-change' | 'conflict' | 'reconnect';
  userId?: string;
  timestamp: number;
  data?: any;
}

export interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  length?: number;
  text?: string;
  userId?: string;
  timestamp: number;
}

export interface Conflict {
  id: string;
  type: 'state' | 'operation' | 'selection';
  conflictingOperations: Operation[];
  resolved: boolean;
  resolution?: 'last-write-wins' | 'merge' | 'manual';
  timestamp: number;
}

export interface CollaborationState {
  users: Map<string, User>;
  operations: Operation[];
  conflicts: Conflict[];
  localState: any;
  remoteState: any;
  lastSync: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'offline';
  syncCount: number;
  conflictCount: number;
}

export interface RealtimeDocument {
  id: string;
  content: string;
  operations: Operation[];
  version: number;
  collaborators: Map<string, User>;
  config: CollaborationConfig;
}

export class RealtimeCollaboration {
  private config: CollaborationConfig;
  private state: CollaborationState;
  private document: RealtimeDocument;
  private eventListeners: Map<string, Set<(event: CollaborationEvent) => void>>;
  private syncTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private offlineQueue: any[] = [];
  private connection: any = null;
  private operationBuffer: Operation[] = [];
  private conflictResolver: ConflictResolver;

  constructor(config: CollaborationConfig = {}) {
    this.config = {
      serverUrl: 'ws://localhost:8080',
      roomId: 'default-room',
      userId: this.generateUserId(),
      userName: 'User',
      enableOffline: true,
      conflictResolution: 'operational-transform',
      syncInterval: 1000,
      retryAttempts: 5,
      enableAnalytics: true,
      enablePresence: true,
      enableCursors: true,
      enableSelections: true,
      ...config
    };

    this.state = {
      users: new Map(),
      operations: [],
      conflicts: [],
      localState: {},
      remoteState: {},
      lastSync: Date.now(),
      connectionStatus: 'disconnected',
      syncCount: 0,
      conflictCount: 0
    };

    this.document = {
      id: this.config.roomId || 'default',
      content: '',
      operations: [],
      version: 0,
      collaborators: new Map(),
      config: this.config
    };

    this.eventListeners = new Map();
    this.conflictResolver = new ConflictResolver(this.config.conflictResolution);

    this.initializeConnection();
    this.startPeriodicSync();
  }

  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeConnection(): void {
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket not supported, using offline mode');
      this.state.connectionStatus = 'offline';
      return;
    }

    try {
      this.connection = new WebSocket(this.config.serverUrl);
      
      this.connection.onopen = () => {
        this.state.connectionStatus = 'connected';
        this.sendJoinEvent();
        this.processOfflineQueue();
        this.emitEvent({ type: 'reconnect', timestamp: Date.now() });
      };

      this.connection.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.connection.onclose = () => {
        this.state.connectionStatus = 'disconnected';
        this.scheduleReconnect();
      };

      this.connection.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.state.connectionStatus = 'disconnected';
      };
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.state.connectionStatus = 'offline';
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.state.connectionStatus === 'disconnected') {
        this.initializeConnection();
      }
    }, 5000);
  }

  private handleServerMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'state-update':
          this.handleRemoteStateUpdate(message.data);
          break;
        case 'user-joined':
          this.handleUserJoined(message.data);
          break;
        case 'user-left':
          this.handleUserLeft(message.data);
          break;
        case 'operation':
          this.handleRemoteOperation(message.data);
          break;
        case 'conflict':
          this.handleConflict(message.data);
          break;
        case 'sync-response':
          this.handleSyncResponse(message.data);
          break;
      }
    } catch (error) {
      console.error('Error handling server message:', error);
    }
  }

  private handleRemoteStateUpdate(data: any): void {
    this.state.remoteState = data.state;
    this.state.lastSync = Date.now();
    this.state.syncCount++;
    
    this.emitEvent({
      type: 'state-update',
      userId: data.userId,
      timestamp: Date.now(),
      data
    });
  }

  private handleUserJoined(data: User): void {
    this.state.users.set(data.id, data);
    this.document.collaborators.set(data.id, data);
    
    this.emitEvent({
      type: 'user-joined',
      userId: data.id,
      timestamp: Date.now(),
      data
    });
  }

  private handleUserLeft(data: User): void {
    this.state.users.delete(data.id);
    this.document.collaborators.delete(data.id);
    
    this.emitEvent({
      type: 'user-left',
      userId: data.id,
      timestamp: Date.now(),
      data
    });
  }

  private handleRemoteOperation(operation: Operation): void {
    if (operation.userId === this.config.userId) {
      return; // Ignore own operations
    }

    // Apply operational transformation
    const transformedOperation = this.conflictResolver.transformOperation(
      operation,
      this.operationBuffer
    );

    // Apply the operation to the document
    this.applyOperation(transformedOperation);
    
    // Add to operations history
    this.document.operations.push(transformedOperation);
    this.document.version++;

    // Clear buffer for this user
    this.operationBuffer = this.operationBuffer.filter(
      op => op.userId !== operation.userId
    );

    this.emitEvent({
      type: 'state-update',
      userId: operation.userId,
      timestamp: Date.now(),
      data: { operation: transformedOperation }
    });
  }

  private handleConflict(conflict: Conflict): void {
    this.state.conflicts.push(conflict);
    this.state.conflictCount++;

    // Auto-resolve if configured
    if (this.config.conflictResolution === 'last-write-wins') {
      const resolved = this.conflictResolver.resolveLastWriteWins(conflict);
      this.applyOperation(resolved);
      
      conflict.resolved = true;
      conflict.resolution = 'last-write-wins';
    }

    this.emitEvent({
      type: 'conflict',
      timestamp: Date.now(),
      data: conflict
    });
  }

  private handleSyncResponse(data: any): void {
    this.state.lastSync = Date.now();
    this.state.syncCount++;

    // Apply remote operations
    if (data.operations) {
      data.operations.forEach((op: Operation) => {
        this.applyOperation(op);
      });
    }

    // Update user presence
    if (data.users) {
      data.users.forEach((user: User) => {
        this.state.users.set(user.id, user);
      });
    }

    this.emitEvent({
      type: 'state-update',
      timestamp: Date.now(),
      data
    });
  }

  private applyOperation(operation: Operation): void {
    switch (operation.type) {
      case 'insert':
        this.document.content = 
          this.document.content.slice(0, operation.position) +
          (operation.text || '') +
          this.document.content.slice(operation.position);
        break;
      case 'delete':
        this.document.content = 
          this.document.content.slice(0, operation.position) +
          this.document.content.slice((operation.position || 0) + (operation.length || 0));
        break;
      case 'retain':
        // No-op for retain operations
        break;
    }
  }

  private sendJoinEvent(): void {
    const user: User = {
      id: this.config.userId!,
      name: this.config.userName!,
      color: this.generateUserColor(),
      online: true,
      lastSeen: Date.now()
    };

    this.sendToServer({
      type: 'join',
      data: user
    });

    this.state.users.set(user.id, user);
    this.document.collaborators.set(user.id, user);
  }

  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private sendToServer(message: any): void {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(message));
    } else if (this.config.enableOffline) {
      this.offlineQueue.push(message);
    }
  }

  private processOfflineQueue(): void {
    if (this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    queue.forEach(message => {
      this.sendToServer(message);
    });
  }

  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.state.connectionStatus === 'connected') {
        this.syncWithServer();
      }
    }, this.config.syncInterval);
  }

  private syncWithServer(): void {
    const syncMessage = {
      type: 'sync',
      data: {
        userId: this.config.userId,
        state: this.state.localState,
        operations: this.operationBuffer,
        version: this.document.version
      }
    };

    this.sendToServer(syncMessage);
  }

  // Public API
  public updateLocalState(state: any): void {
    this.state.localState = { ...this.state.localState, ...state };
    
    // Create operation for state change
    const operation: Operation = {
      type: 'retain',
      position: 0,
      timestamp: Date.now(),
      userId: this.config.userId
    };

    this.operationBuffer.push(operation);
    this.sendToServer({
      type: 'state-update',
      data: { state: this.state.localState, userId: this.config.userId }
    });
  }

  public updateCursor(position: { x: number; y: number }): void {
    if (!this.config.enableCursors) return;

    const cursorUpdate = {
      type: 'cursor-move',
      userId: this.config.userId,
      timestamp: Date.now(),
      data: { position }
    };

    this.sendToServer(cursorUpdate);

    // Update local user cursor
    const localUser = this.state.users.get(this.config.userId!);
    if (localUser) {
      localUser.cursor = position;
      this.state.users.set(this.config.userId!, localUser);
    }
  }

  public updateSelection(selection: { start: number; end: number }): void {
    if (!this.config.enableSelections) return;

    const selectionUpdate = {
      type: 'selection-change',
      userId: this.config.userId,
      timestamp: Date.now(),
      data: { selection }
    };

    this.sendToServer(selectionUpdate);

    // Update local user selection
    const localUser = this.state.users.get(this.config.userId!);
    if (localUser) {
      localUser.selection = selection;
      this.state.users.set(this.config.userId!, localUser);
    }
  }

  public insertText(position: number, text: string): void {
    const operation: Operation = {
      type: 'insert',
      position,
      text,
      timestamp: Date.now(),
      userId: this.config.userId
    };

    this.operationBuffer.push(operation);
    this.applyOperation(operation);
    
    this.sendToServer({
      type: 'operation',
      data: operation
    });
  }

  public deleteText(position: number, length: number): void {
    const operation: Operation = {
      type: 'delete',
      position,
      length,
      timestamp: Date.now(),
      userId: this.config.userId
    };

    this.operationBuffer.push(operation);
    this.applyOperation(operation);
    
    this.sendToServer({
      type: 'operation',
      data: operation
    });
  }

  public addEventListener(eventType: string, callback: (event: CollaborationEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  private emitEvent(event: CollaborationEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
  }

  public getUsers(): User[] {
    return Array.from(this.state.users.values());
  }

  public getUser(userId: string): User | undefined {
    return this.state.users.get(userId);
  }

  public getDocument(): RealtimeDocument {
    return { ...this.document };
  }

  public getState(): CollaborationState {
    return { ...this.state };
  }

  public getConnectionStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'offline' {
    return this.state.connectionStatus;
  }

  public getConflicts(): Conflict[] {
    return [...this.state.conflicts];
  }

  public resolveConflict(conflictId: string, resolution: 'last-write-wins' | 'merge' | 'manual'): void {
    const conflict = this.state.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    if (resolution === 'last-write-wins') {
      const resolved = this.conflictResolver.resolveLastWriteWins(conflict);
      this.applyOperation(resolved);
    } else if (resolution === 'merge') {
      const resolved = this.conflictResolver.resolveMerge(conflict);
      this.applyOperation(resolved);
    }

    conflict.resolved = true;
    conflict.resolution = resolution;

    this.emitEvent({
      type: 'conflict',
      timestamp: Date.now(),
      data: { ...conflict, resolved: true, resolution }
    });
  }

  public disconnect(): void {
    if (this.connection) {
      this.connection.close();
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.state.connectionStatus = 'disconnected';
  }

  public reconnect(): void {
    this.disconnect();
    this.initializeConnection();
  }

  public exportDocument(): { content: string; version: number; operations: Operation[]; collaborators: User[] } {
    return {
      content: this.document.content,
      version: this.document.version,
      operations: [...this.document.operations],
      collaborators: Array.from(this.document.collaborators.values())
    };
  }

  public importDocument(data: { content: string; operations?: Operation[] }): void {
    this.document.content = data.content;
    if (data.operations) {
      this.document.operations = data.operations;
      this.document.version = data.operations.length;
    }
  }
}

class ConflictResolver {
  private strategy: 'last-write-wins' | 'operational-transform' | 'custom';

  constructor(strategy: 'last-write-wins' | 'operational-transform' | 'custom' = 'operational-transform') {
    this.strategy = strategy;
  }

  public transformOperation(operation: Operation, otherOperations: Operation[]): Operation {
    if (this.strategy === 'operational-transform') {
      return this.applyOperationalTransformation(operation, otherOperations);
    }
    return operation;
  }

  private applyOperationalTransformation(operation: Operation, otherOperations: Operation[]): Operation {
    let transformedOperation = { ...operation };

    for (const otherOp of otherOperations) {
      if (otherOp.userId === operation.userId) {
        continue; // Don't transform against own operations
      }

      if (otherOp.type === 'insert' && otherOp.position <= operation.position) {
        transformedOperation.position += otherOp.length || 0;
      } else if (otherOp.type === 'delete' && otherOp.position <= operation.position) {
        transformedOperation.position -= otherOp.length || 0;
      }
    }

    return transformedOperation;
  }

  public resolveLastWriteWins(conflict: Conflict): Operation {
    if (conflict.conflictingOperations.length === 0) {
      throw new Error('No conflicting operations to resolve');
    }

    // Return the latest operation based on timestamp
    const latestOp = conflict.conflictingOperations.reduce((latest, current) => {
      return current.timestamp > latest.timestamp ? current : latest;
    });

    return latestOp;
  }

  public resolveMerge(conflict: Conflict): Operation {
    if (conflict.conflictingOperations.length === 0) {
      throw new Error('No conflicting operations to resolve');
    }

    // Simple merge: concatenate all insert operations
    const insertOperations = conflict.conflictingOperations.filter(op => op.type === 'insert');
    const deleteOperations = conflict.conflictingOperations.filter(op => op.type === 'delete');

    if (insertOperations.length > 0) {
      const mergedText = insertOperations.map(op => op.text || '').join('');
      return {
        type: 'insert',
        position: insertOperations[0].position,
        text: mergedText,
        timestamp: Date.now(),
        userId: 'system'
      };
    }

    if (deleteOperations.length > 0) {
      const totalLength = deleteOperations.reduce((sum, op) => sum + (op.length || 0), 0);
      return {
        type: 'delete',
        position: deleteOperations[0].position,
        length: totalLength,
        timestamp: Date.now(),
        userId: 'system'
      };
    }

    return conflict.conflictingOperations[0];
  }
}

// Utility functions for real-time collaboration
export const CollaborationUtils = {
  generateUserId: (): string => {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  generateRoomId: (): string => {
    return `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  sanitizeUserInput: (input: string): string => {
    // Remove potentially harmful content
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  },

  validateOperation: (operation: Operation): boolean => {
    if (!operation.type || !['insert', 'delete', 'retain'].includes(operation.type)) {
      return false;
    }

    if (operation.type === 'insert' && !operation.text) {
      return false;
    }

    if (operation.type === 'delete' && typeof operation.length !== 'number') {
      return false;
    }

    if (operation.position < 0) {
      return false;
    }

    return true;
  },

  calculateDocumentHash: (content: string): string => {
    // Simple hash function for document content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  },

  formatCollaborationEvent: (event: CollaborationEvent): string => {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    return `[${timestamp}] ${event.type.toUpperCase()} - User: ${event.userId || 'system'}`;
  }
};

// Factory function for creating collaboration instances
export function createCollaboration(config: CollaborationConfig): RealtimeCollaboration {
  return new RealtimeCollaboration(config);
}

// Default collaboration configuration
export const DefaultCollaborationConfig: CollaborationConfig = {
  serverUrl: 'ws://localhost:8080',
  roomId: 'default-room',
  userId: CollaborationUtils.generateUserId(),
  userName: 'Anonymous User',
  enableOffline: true,
  conflictResolution: 'operational-transform',
  syncInterval: 1000,
  retryAttempts: 5,
  enableAnalytics: true,
  enablePresence: true,
  enableCursors: true,
  enableSelections: true
};

// Event types for collaboration
export const CollaborationEvents = {
  STATE_UPDATE: 'state-update',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  CURSOR_MOVE: 'cursor-move',
  SELECTION_CHANGE: 'selection-change',
  CONFLICT: 'conflict',
  RECONNECT: 'reconnect'
};