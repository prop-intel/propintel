import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testOpenAI() {
  console.log('Testing OpenAI API key...');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set in environment');
    return;
  }

  console.log('API key starts with:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');

  try {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('Attempting to call OpenAI API...');

    const result = await generateText({
      model: openai('gpt-3.5-turbo'),
      prompt: 'Say "test"',
      maxTokens: 5,
      abortSignal: AbortSignal.timeout(10000),
    });

    console.log('Success! Response:', result.text);
  } catch (error) {
    console.error('Error calling OpenAI:', error.message);

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\n❌ Your OpenAI API key appears to be invalid or expired.');
      console.error('Please update the OPENAI_API_KEY in your .env file with a valid key.');
    } else if (error.message.includes('429')) {
      console.error('\n⚠️ Rate limited by OpenAI. The key is valid but you\'ve hit usage limits.');
    } else if (error.message.includes('timeout')) {
      console.error('\n⏱️ Request timed out. Network issue or OpenAI API is down.');
    } else {
      console.error('\n❓ Unexpected error. Check the error message above.');
    }
  }
}

testOpenAI();