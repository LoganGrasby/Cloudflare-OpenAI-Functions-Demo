import OpenAI from 'openai';
import cheerio from "cheerio"; 

async function read_website_content(url) {
  console.log("reading website content");

  const response = await fetch(url);
  const body = await response.text();
  let cheerioBody = await cheerio.load(body);
  const resp = {
    website_body: cheerioBody("p").text(),
    url: url
  }
  return JSON.stringify(resp);
}

export default {
  async fetch(request, env, ctx) {
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });

    try {
		const url = new URL(request.url);
		const message = url.searchParams.get('message');
    
		const messages = [
		  { role: "user", content: message ? message : "What's happening in the NBA today?" }
		];
    
	   const tools = [
        {
          type: "function",
          function: {
            name: "read_website_content",
            description: "Read the content on a given website",
            parameters: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL to the website to read",
                }
              },
              required: ["url"],
            },
          },
        }
      ];

      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      });

      const assistantMessage = chatCompletion.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === "read_website_content") {
            const url = JSON.parse(toolCall.function.arguments).url;
            const websiteContent = await read_website_content(url);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: websiteContent
            });
          }
        }

        const secondChatCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo-1106",
          messages: messages,
        });
		
		console.log(messages)
        return new Response(secondChatCompletion.choices[0].message.content);
      } else {
        return new Response(assistantMessage.content);
      }
    } catch (e) {
      return new Response(e.message, { status: 500 });
    }
  },
};
