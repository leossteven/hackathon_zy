# 中研小分队AI对话机器人 — 基于NVIDIA NeMo Agent Toolkit的智能对话系统

> 🏆 中研小分队项目 — 基于NVIDIA官方NeMo Agent Toolkit开发，展示AI Agent强大能力


![AI对话机器人界面](docs/ui_screenshot.png)


## 项目概述

本项目是中研小分队基于NVIDIA NeMo Agent Toolkit构建的智能对话机器人示例，完全依托NVIDIA技术栈开发。系统整合实时网络搜索、时间查询等功能，并支持用户配置OpenAI兼容的API接口，是学习与实践AI Agent开发的理想案例。

## 核心功能

- 🤖 **官方技术栈**：完全基于NVIDIA NeMo Agent Toolkit构建
- 🌐 **实时搜索能力**：集成Tavily API，提供实时网络检索
- ⏰ **时间查询**：支持获取当前日期与时间信息
- 🔧 **高度可配置**：兼容任意OpenAI格式API，支持自定义密钥与模型
- 🎨 **现代化界面**：简洁UI设计，支持实时对话与流式响应
- 🚀 **跨平台部署**：提供Windows/Linux/macOS一键安装脚本

## 技术架构

### 前端

- **框架**：Next.js 14 + TypeScript
- **功能**：实时聊天、主题切换、历史记录管理

### 后端

- **核心引擎**：NVIDIA NeMo Agent Toolkit (AIQ)
- **工作流类型**：React Agent
- **工具集成**：Tavily搜索、时间查询工具

### 模型支持

- **默认模型**：Qwen
- **兼容性**：支持所有符合OpenAI API标准的模型
- **自定义配置**：支持用户设置API密钥、模型名称及base_url

## 快速开始

### 环境要求

- **Python** 3.12+
- **Node.js** 18+
- **Git** 最新版本
- **操作系统**：Windows 10+ / macOS 10.15+ / Ubuntu 20.04+

### 项目亮点

- ✅ **严格遵循官方架构**：符合NVIDIA技术规范
- ✅ **生产就绪**：完备的错误处理、日志与监控机制
- ✅ **模块化设计**：易于扩展新功能
- ✅ **全面跨平台支持**：兼容主流操作系统

### 演示视频

📺 [观看视频演示](https://www.bilibili.com/video/BV1NvYLznEPT/?vd_source=528985482ddde4cb7578468e9c832fe6)
