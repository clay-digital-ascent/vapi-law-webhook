import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: 'reardon-injury-law',
  location: 'us-central1',
});

const models = ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];

for (const modelName of models) {
  console.log(`\nTrying: ${modelName}`);
  try {
    const model = vertexAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] });
    console.log(`✅ ${modelName} WORKS!`);
    break;
  } catch (e) {
    console.log(`❌ ${modelName}: ${e.message.substring(0, 120)}`);
  }
}
