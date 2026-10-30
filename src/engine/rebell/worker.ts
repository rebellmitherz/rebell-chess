import { createEngineHost, type EngineRequest } from './protocol';

// Eigener Thread: Die Suche rechnet am Stück, die Oberfläche bleibt dabei flüssig
const handle = createEngineHost();

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const response = handle(event.data);
  if (response) self.postMessage(response);
};
