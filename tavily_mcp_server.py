#!/usr/bin/env python3
"""
Tavily MCP服务器
按照NVIDIA官方MCP架构实现Tavily搜索工具
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    ListToolsResult,
    Tool,
    TextContent,
)

from tavily import TavilyClient

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Tavily API配置
TAVILY_API_KEY = "Your API Key"

class TavilyMCPServer:
    """Tavily MCP服务器类"""
    
    def __init__(self):
        self.server = Server("tavily-search")
        self.tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
        self.setup_handlers()
    
    def setup_handlers(self):
        """设置MCP处理器"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """列出可用的工具"""
            return [
                Tool(
                    name="tavily_search",
                    description="Search the web using Tavily API. Provides real-time web search results.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query"
                            },
                            "max_results": {
                                "type": "integer",
                                "description": "Maximum number of results to return (default: 5)",
                                "default": 5
                            }
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="tavily_weather_search",
                    description="Search for weather information using Tavily API.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The location to search weather for"
                            }
                        },
                        "required": ["location"]
                    }
                ),
                Tool(
                    name="tavily_company_search",
                    description="Search for company information using Tavily API.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "company": {
                                "type": "string",
                                "description": "The company name to search for"
                            }
                        },
                        "required": ["company"]
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """调用工具"""
            try:
                if name == "tavily_search":
                    return await self._tavily_search(arguments)
                elif name == "tavily_weather_search":
                    return await self._tavily_weather_search(arguments)
                elif name == "tavily_company_search":
                    return await self._tavily_company_search(arguments)
                else:
                    raise ValueError(f"Unknown tool: {name}")
            except Exception as e:
                logger.error(f"Tool call failed: {e}")
                return [TextContent(type="text", text=f"Error: {str(e)}")]
    
    async def _tavily_search(self, arguments: Dict[str, Any]) -> List[TextContent]:
        """执行Tavily搜索"""
        query = arguments.get("query", "")
        max_results = arguments.get("max_results", 5)
        
        if not query:
            return [TextContent(type="text", text="Error: Query is required")]
        
        try:
            logger.info(f"Executing Tavily search: {query}")
            
            # 调用Tavily API
            response = self.tavily_client.search(
                query=query,
                max_results=max_results,
                search_depth="basic",
                include_answer=True,
                include_raw_content=False
            )
            
            # 格式化结果
            result = self._format_search_result(response, query)
            
            return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]
            
        except Exception as e:
            logger.error(f"Tavily search failed: {e}")
            return [TextContent(type="text", text=f"Search failed: {str(e)}")]
    
    async def _tavily_weather_search(self, arguments: Dict[str, Any]) -> List[TextContent]:
        """执行天气搜索"""
        location = arguments.get("location", "")
        
        if not location:
            return [TextContent(type="text", text="Error: Location is required")]
        
        query = f"{location} weather today temperature"
        return await self._tavily_search({"query": query, "max_results": 3})
    
    async def _tavily_company_search(self, arguments: Dict[str, Any]) -> List[TextContent]:
        """执行公司信息搜索"""
        company = arguments.get("company", "")
        
        if not company:
            return [TextContent(type="text", text="Error: Company name is required")]
        
        query = f"{company} company information official website"
        return await self._tavily_search({"query": query, "max_results": 3})
    
    def _format_search_result(self, response: Dict[str, Any], query: str) -> Dict[str, Any]:
        """格式化搜索结果"""
        try:
            results = response.get("results", [])
            answer = response.get("answer", "")
            
            # 格式化结果列表
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "title": result.get("title", ""),
                    "url": result.get("url", ""),
                    "content": result.get("content", ""),
                    "score": result.get("score", 0)
                })
            
            # 生成摘要答案
            if answer:
                summary = answer
            elif formatted_results:
                # 如果没有直接答案，从结果中生成摘要
                summary = self._generate_summary(formatted_results, query)
            else:
                summary = f"No relevant information found for '{query}'."
            
            return {
                "query": query,
                "answer": summary,
                "results": formatted_results,
                "total_results": len(formatted_results)
            }
            
        except Exception as e:
            logger.error(f"Failed to format search result: {e}")
            return {
                "query": query,
                "answer": f"Result processing failed: {str(e)}",
                "results": [],
                "error": str(e)
            }
    
    def _generate_summary(self, results: List[Dict[str, Any]], query: str) -> str:
        """从搜索结果生成摘要"""
        if not results:
            return f"No relevant information found for '{query}'."
        
        # 取前3个结果的内容片段
        summary_parts = []
        for i, result in enumerate(results[:3]):
            content = result.get("content", "").strip()
            if content:
                # 截取前200个字符
                snippet = content[:200] + "..." if len(content) > 200 else content
                summary_parts.append(f"{i+1}. {snippet}")
        
        if summary_parts:
            return f"Based on search results for '{query}':\n\n" + "\n\n".join(summary_parts)
        else:
            return f"Found search results for '{query}', but content summary is not available."
    
    async def run(self):
        """运行MCP服务器"""
        logger.info("Starting Tavily MCP Server...")
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )

async def main():
    """主函数"""
    server = TavilyMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())

