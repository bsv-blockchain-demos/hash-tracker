// WhatsOnChain API client for BSV blockchain data

export interface BlockHeader {
  hash: string;
  height: number;
  time: number;
  bits: string;
  difficulty: number;
}

export interface ChainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  pruned: boolean;
}

const BASE_URL = 'https://api.whatsonchain.com/v1/bsv/main';
const TIMEOUT_MS = 12000;

class WhatsOnChainError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'WhatsOnChainError';
  }
}

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new WhatsOnChainError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new WhatsOnChainError('Request timeout - API took too long to respond');
    }
    throw error;
  }
}

export async function getTipHeight(): Promise<number> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/chain/info`);
    const data: ChainInfo = await response.json();
    return data.headers;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch tip height: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHeader(height: number): Promise<BlockHeader> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/block/headers/${height}`);
    const data: BlockHeader[] = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new WhatsOnChainError(`No header data returned for height ${height}`);
    }
    
    const header = data[0];
    
    // Validate required fields
    if (!header.hash || typeof header.height !== 'number' || typeof header.time !== 'number') {
      throw new WhatsOnChainError(`Invalid header data for height ${height}`);
    }
    
    return header;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch header for height ${height}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHeaders(): Promise<Map<number, BlockHeader>> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/block/headers`);
    const data: BlockHeader[] = await response.json();
    
    if (!Array.isArray(data)) {
      throw new WhatsOnChainError('Invalid headers data returned from API');
    }
    
    const headerMap = new Map<number, BlockHeader>();
    
    data.forEach((header) => {
      // Validate required fields
      if (!header.hash || typeof header.height !== 'number' || typeof header.time !== 'number') {
        console.warn(`Invalid header data for height ${header.height}:`, header);
        return;
      }
      
      headerMap.set(header.height, header);
    });
    
    return headerMap;
  } catch (error) {
    if (error instanceof WhatsOnChainError) {
      throw error;
    }
    throw new WhatsOnChainError(`Failed to fetch headers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}