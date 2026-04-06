import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: '请上传图片' },
        { status: 400 }
      );
    }

    // 检查文件大小（限制10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '图片大小超过10MB，请压缩后重试' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64Image}`;

    // 使用火山引擎豆包 API
    const apiKey = 'd909cbf0-549a-4cdc-abc5-528c2064d05b';
    const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/responses';

    const response = await Promise.race([
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'doubao-seed-2-0-pro-260215',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_image',
                  image_url: dataUri,
                },
                {
                  type: 'input_text',
                  text: `请仔细观察这张图片，识别并提取以下信息。如果某个字段在图片中找不到，请明确标注"未找到"。

请严格按以下JSON格式返回（不要添加任何其他文字）：

{
  "生产厂家": "具体的生产厂家名称",
  "生产日期": "日期（保留原图中的格式，如：2018-10、2018-10-15、2018年10月等）",
  "出厂编号": "产品出厂编号或序列号",
  "企业钢码": "企业钢码或钢印编号"
}

重要提示：
1. 必须返回JSON格式，不要包含任何其他文字
2. 如果某个字段找不到，填写"未找到"而不是空字符串
3. 生产日期要保留原图中的原始格式，不要转换
4. 常见日期格式：YYYY-MM、YYYY-MM-DD、YYYY年MM月、YYYY/MM、YYYY/MM/DD等
5. 不要使用markdown代码块（不要用\`\`\`json包裹）
6. 直接返回纯JSON文本
7. 字段名称必须完全匹配：生产厂家、生产日期、出厂编号、企业钢码`
                }
              ]
            }
          ]
        }),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时')), 60000) // 60秒超时
      )
    ]);

    if (!(response instanceof Response)) {
      throw new Error('请求超时');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API错误:', errorData);
      throw new Error(errorData.error?.message || `API返回错误: ${response.status}`);
    }

    const data = await response.json();
    console.log('📥 API完整响应:', JSON.stringify(data, null, 2));

    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content;
      console.log('✅ 从 choices.message.content 提取内容');
    } else if (data.output && data.output[0] && data.output[0].content) {
      content = data.output[0].content;
      console.log('✅ 从 output[0].content 提取内容');
    } else if (typeof data === 'object' && data.content) {
      content = data.content;
      console.log('✅ 从 data.content 提取内容');
    } else {
      content = JSON.stringify(data);
      console.log('⚠️ 无法提取内容，返回原始数据');
    }

    console.log('📝 提取到的文本内容:', content);

    let result: Record<string, string> = {
      manufacturer: '',
      productionDate: '',
      serialNumber: '',
      steelCode: ''
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('✅ 找到JSON格式:', jsonMatch[0]);
        result = JSON.parse(jsonMatch[0]);
        console.log('✅ 解析结果:', result);

        // 处理生产日期：保留原始格式或提取日期
        if (result.生产日期) {
          const dateText = result.生产日期;
          console.log('📅 原始日期文本:', dateText);

          // 检查是否是"未找到"
          if (dateText === '未找到' || dateText === '' || dateText === null) {
            result.productionDate = '';
          } else {
            // 提取日期部分，去掉多余文字
            // 匹配各种日期格式：2018-10、2018-10-15、2018年10月、2018/10等
            const datePatterns = [
              /(\d{4})[-年\/](\d{1,2})(?:[-月\/](\d{1,2}))?/,  // 2018-10, 2018-10-15, 2018年10月
              /(\d{4})[-年\/](\d{1,2})[-月\/](\d{1,2})/,        // 2018-10-15
              /(\d{4})年(\d{1,2})月(?:\d{1,2}日)?/,            // 2018年10月
              /(\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?/,             // 2018.10
            ];

          for (const pattern of datePatterns) {
            const match = dateText.match(pattern);
            if (match) {
              const year = match[1];
              const month = match[2].padStart(2, '0');
              const day = match[3] ? match[3].padStart(2, '0') : '';
              result.productionDate = day ? `${year}-${month}-${day}` : `${year}-${month}`;
              console.log('📅 提取的日期:', result.productionDate);
              break;
            }
          }

          // 如果没有匹配到，保留原始文本
          if (!result.productionDate) {
            result.productionDate = dateText;
            console.log('📅 保留原始日期:', result.productionDate);
          }
          }
        }
      } else {
        console.log('⚠️ 未找到JSON格式，尝试其他方法');
        // 使用正则表达式提取
        const manufacturerMatch = content.match(/生产厂[家称]*[:：]\s*([^\n]+)/);
        const dateMatch = content.match(/生产日期[:：]\s*([^\n]+)/);
        const serialMatch = content.match(/出厂编号[:：]\s*([^\n]+)/);
        const steelMatch = content.match(/企业钢码[:：]\s*([^\n]+)/);

        if (manufacturerMatch) result.manufacturer = manufacturerMatch[1].trim();
        if (dateMatch) {
          // 从日期文本中提取日期部分
          const dateText = dateMatch[1].trim();
          const datePatterns = [
            /(\d{4})[-年\/](\d{1,2})(?:[-月\/](\d{1,2}))?/,
          ];
          for (const pattern of datePatterns) {
            const match = dateText.match(pattern);
            if (match) {
              const year = match[1];
              const month = match[2].padStart(2, '0');
              const day = match[3] ? match[3].padStart(2, '0') : '';
              result.productionDate = day ? `${year}-${month}-${day}` : `${year}-${month}`;
              break;
            }
          }
          if (!result.productionDate) {
            result.productionDate = dateText;
          }
        }
        if (serialMatch) result.serialNumber = serialMatch[1].trim();
        if (steelMatch) result.steelCode = steelMatch[1].trim();

        console.log('🔍 正则提取结果:', result);
      }
    } catch (error) {
      console.error('❌ JSON解析失败:', error);
    }

    console.log('📤 最终返回结果:', {
      manufacturer: result.生产厂家 || result.manufacturer || '',
      productionDate: result.生产日期 || result.productionDate || '',
      serialNumber: result.出厂编号 || result.serialNumber || '',
      steelCode: result.企业钢码 || result.steelCode || ''
    });

    return NextResponse.json({
      manufacturer: result.生产厂家 || result.manufacturer || '',
      productionDate: result.生产日期 || result.productionDate || '',
      serialNumber: result.出厂编号 || result.serialNumber || '',
      steelCode: result.企业钢码 || result.steelCode || ''
    });
  } catch (error) {
    console.error('OCR识别错误:', error);
    const errorMessage = error instanceof Error ? error.message : 'OCR识别失败';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
