import type { Server } from 'http';

/** Bind an HTTP server and return the actual TCP port, including for port 0. */
export function listenHttpServer(server: Server, port: number, host: string): Promise<number> {
  if (server.listening) {
    return Promise.reject(new Error('HTTP server is already listening'));
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off('error', onError);
      server.off('listening', onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('HTTP server did not expose a TCP address'));
        return;
      }
      resolve(address.port);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    try {
      server.listen(port, host);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
