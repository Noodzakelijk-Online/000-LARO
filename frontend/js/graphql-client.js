/**
 * GraphQL Client for Legal AI Platform
 * 
 * This module provides a client-side interface for interacting with the GraphQL API.
 * It includes support for queries, mutations, persisted queries, and edge computing features.
 */

class GraphQLClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/graphql';
    this.persistedEndpoint = options.persistedEndpoint || '/graphql/persisted';
    this.cache = new Map();
    this.persistedQueries = new Map();
    
    // Initialize persisted queries
    this.initializePersistedQueries();
  }
  
  /**
   * Initialize persisted queries
   */
  async initializePersistedQueries() {
    // Common queries that will be persisted for better performance
    const queries = {
      getUserCases: `
        query GetUserCases($userId: ID!) {
          user(id: $userId) {
            id
            name
            cases {
              id
              title
              status
              category
              createdAt
            }
          }
        }
      `,
      
      getCaseDetails: `
        query GetCaseDetails($caseId: ID!) {
          case(id: $caseId) {
            id
            title
            description
            status
            category
            createdAt
            updatedAt
            client {
              id
              name
              email
            }
            assignedLawyers {
              id
              name
              specialization
              experience
            }
            documents {
              id
              title
              fileType
              uploadedAt
              url
            }
            messages {
              id
              content
              sentAt
              readStatus
              sender {
                id
                name
              }
            }
          }
        }
      `,
      
      getMetrics: `
        query GetMetrics($startDate: String, $endDate: String) {
          metrics(startDate: $startDate, endDate: $endDate) {
            totalCases
            resolvedCases
            averageResolutionTime
            clientSatisfactionRate
            topCategories {
              category
              count
              percentage
            }
            monthlyTrends {
              month
              newCases
              resolvedCases
              averageResolutionTime
            }
          }
        }
      `,
      
      getLawyers: `
        query GetLawyers($specialization: String) {
          lawyers(specialization: $specialization) {
            id
            name
            email
            specialization
            experience
            successRate
          }
        }
      `
    };
    
    // Register persisted queries
    for (const [name, query] of Object.entries(queries)) {
      // Generate a hash for the query (in a real implementation, this would be a proper hash function)
      const queryId = btoa(name).replace(/=/g, '');
      
      // Store the query with its ID
      this.persistedQueries.set(queryId, {
        name,
        query
      });
      
      // Register the query with the server
      try {
        await this.registerPersistedQuery(queryId, query);
      } catch (error) {
        console.error(`Failed to register persisted query ${name}:`, error);
      }
    }
    
    console.log(`Initialized ${this.persistedQueries.size} persisted queries`);
  }
  
  /**
   * Register a persisted query with the server
   */
  async registerPersistedQuery(queryId, query) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation RegisterPersistedQuery($id: String!, $query: String!) {
              _registerPersistedQuery(id: $id, query: $query)
            }
          `,
          variables: {
            id: queryId,
            query
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      return result.data?._registerPersistedQuery;
    } catch (error) {
      console.warn(`Failed to register persisted query, falling back to regular queries:`, error);
      return false;
    }
  }
  
  /**
   * Execute a GraphQL query
   */
  async query(query, variables = {}, options = {}) {
    // Check if this is a known persisted query
    const persistedQueryId = this.findPersistedQueryId(query);
    
    if (persistedQueryId && !options.skipPersisted) {
      return this.executePersistedQuery(persistedQueryId, variables);
    }
    
    // Check cache if caching is enabled
    if (options.useCache !== false) {
      const cacheKey = this.getCacheKey(query, variables);
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult && !this.isCacheExpired(cachedResult, options.cacheTTL)) {
        console.log(`Cache hit for query: ${this.getQueryName(query)}`);
        return cachedResult.data;
      }
    }
    
    // Execute the query
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Cache the result if caching is enabled
      if (options.useCache !== false) {
        const cacheKey = this.getCacheKey(query, variables);
        this.cache.set(cacheKey, {
          data: result.data,
          timestamp: Date.now()
        });
      }
      
      return result.data;
    } catch (error) {
      console.error(`GraphQL query error:`, error);
      throw error;
    }
  }
  
  /**
   * Execute a persisted GraphQL query
   */
  async executePersistedQuery(queryId, variables = {}) {
    try {
      console.log(`Executing persisted query: ${queryId}`);
      
      const response = await fetch(this.persistedEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: queryId,
          variables
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      return result.data;
    } catch (error) {
      console.error(`Persisted query error:`, error);
      
      // Fall back to regular query
      const persistedQuery = this.persistedQueries.get(queryId);
      if (persistedQuery) {
        console.log(`Falling back to regular query for ${persistedQuery.name}`);
        return this.query(persistedQuery.query, variables, { skipPersisted: true });
      }
      
      throw error;
    }
  }
  
  /**
   * Execute a GraphQL mutation
   */
  async mutate(mutation, variables = {}) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Invalidate cache for affected queries
      this.invalidateCache();
      
      return result.data;
    } catch (error) {
      console.error(`GraphQL mutation error:`, error);
      throw error;
    }
  }
  
  /**
   * Find the ID of a persisted query
   */
  findPersistedQueryId(query) {
    // Normalize the query by removing whitespace
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    
    // Look for a matching persisted query
    for (const [id, { query: persistedQuery }] of this.persistedQueries.entries()) {
      const normalizedPersistedQuery = persistedQuery.replace(/\s+/g, ' ').trim();
      
      if (normalizedQuery === normalizedPersistedQuery) {
        return id;
      }
    }
    
    return null;
  }
  
  /**
   * Get a cache key for a query and variables
   */
  getCacheKey(query, variables) {
    return `${query}:${JSON.stringify(variables)}`;
  }
  
  /**
   * Check if a cached result is expired
   */
  isCacheExpired(cachedResult, ttl = 60) {
    const age = (Date.now() - cachedResult.timestamp) / 1000;
    return age > ttl;
  }
  
  /**
   * Invalidate the entire cache
   */
  invalidateCache() {
    this.cache.clear();
  }
  
  /**
   * Extract the operation name from a GraphQL query
   */
  getQueryName(query) {
    const match = query.match(/query\s+([A-Za-z0-9_]+)/);
    return match ? match[1] : 'UnnamedQuery';
  }
  
  /**
   * Use edge computing for a request
   */
  async useEdgeComputing(operation, data = {}, region = null) {
    try {
      const response = await fetch('/api/edge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation,
          data,
          region
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Edge computing error:`, error);
      throw error;
    }
  }
}

// Create a global instance
window.graphqlClient = new GraphQLClient();

// Helper functions for common operations
window.getUserCases = async (userId) => {
  return graphqlClient.query(`
    query GetUserCases($userId: ID!) {
      user(id: $userId) {
        id
        name
        cases {
          id
          title
          status
          category
          createdAt
        }
      }
    }
  `, { userId });
};

window.getCaseDetails = async (caseId) => {
  return graphqlClient.query(`
    query GetCaseDetails($caseId: ID!) {
      case(id: $caseId) {
        id
        title
        description
        status
        category
        createdAt
        updatedAt
        client {
          id
          name
          email
        }
        assignedLawyers {
          id
          name
          specialization
          experience
        }
        documents {
          id
          title
          fileType
          uploadedAt
          url
        }
        messages {
          id
          content
          sentAt
          readStatus
          sender {
            id
            name
          }
        }
      }
    }
  `, { caseId });
};

window.getMetrics = async (startDate, endDate) => {
  return graphqlClient.query(`
    query GetMetrics($startDate: String, $endDate: String) {
      metrics(startDate: $startDate, endDate: $endDate) {
        totalCases
        resolvedCases
        averageResolutionTime
        clientSatisfactionRate
        topCategories {
          category
          count
          percentage
        }
        monthlyTrends {
          month
          newCases
          resolvedCases
          averageResolutionTime
        }
      }
    }
  `, { startDate, endDate });
};

window.getLawyers = async (specialization) => {
  return graphqlClient.query(`
    query GetLawyers($specialization: String) {
      lawyers(specialization: $specialization) {
        id
        name
        email
        specialization
        experience
        successRate
      }
    }
  `, { specialization });
};

console.log('GraphQL client initialized');
