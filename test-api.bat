@echo off
echo ========================================
echo 火山引擎豆包API测试
echo ========================================
echo.

set API_KEY=d909cbf0-549a-4cdc-abc5-528c2064d05b
set API_URL=https://ark.cn-beijing.volces.com/api/v3/responses

echo 测试API连接...
echo.
echo API Key: %API_KEY%
echo API URL: %API_URL%
echo.

echo 发送测试请求...
curl -X POST "%API_URL%" ^
  -H "Authorization: Bearer %API_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"doubao-seed-2-0-pro-260215\",\"input\":[{\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"你好，请回复：测试成功\"}]}]}"

echo.
echo ========================================
echo 测试完成！
echo ========================================
pause
