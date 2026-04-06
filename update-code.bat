@echo off
echo 正在强制拉取最新代码...

cd /d C:\Users\35572\ocr-image-extractor

echo 1. 停止当前的开发服务器...
echo 请按 Ctrl+C 停止服务器，然后按任意键继续
pause

echo.
echo 2. 拉取最新代码...
git fetch origin
git reset --hard origin/main

echo.
echo 3. 检查代码是否更新成功...
git log --oneline -1

echo.
echo ========================================
echo 代码更新完成！
echo ========================================
echo.
echo 重要提示：
echo 1. 确保已创建 .env.local 文件
echo 2. 确保已填入正确的 API 密钥
echo 3. 然后执行: pnpm next dev --port 5000
echo.
pause
