# OpenPix

通过 [OpenRouter](https://openrouter.ai/) 在浏览器中生成 AI 图像。API Key 与生成记录均保存在本机，不上传服务端。

**在线体验：** [jaylyu.github.io/openpix](https://jaylyu.github.io/openpix)

## 功能

- 支持 GPT-5.4 Image 2、Gemini 3.1 Flash Image
- 预设与自定义尺寸（512–2048 px），最多 3 张参考图
- 生成记录本地缓存：搜索、下载、设为参考图、重新生成
- 明暗主题、OpenRouter 连通检测、成本人民币换算

## 本地运行

```bash
git clone https://github.com/JayLyu/openpix.git
cd openpix
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，填入 OpenRouter API Key 即可使用。

## 技术栈

Next.js · React · Tailwind CSS · shadcn/ui · 静态导出部署 GitHub Pages

## License

MIT
