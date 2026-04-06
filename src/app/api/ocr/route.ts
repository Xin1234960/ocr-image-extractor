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
                  text: '你是一个专业的OCR识别助手。请从图片中准确提取以下字段信息：\n1. 生产厂家\n2. 生产日期\n3. 出厂编号\n4. 企业钢码\n\n请以JSON格式返回结果，字段名必须使用中文（"生产厂家"、"生产日期"、"出厂编号"、"企业钢码"）。如果某个字段在图片中找不到，请返回空字符串。'
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
    console.log('API响应:', JSON.stringify(data, null, 2));

    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content;
    } else if (data.output && data.output[0] && data.output[0].content) {
      content = data.output[0].content;
    } else if (typeof data === 'object' && data.content) {
      content = data.content;
    } else {
      content = JSON.stringify(data);
    }

    let result: Record<string, string>;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          manufacturer: '',
          productionDate: '',
          serialNumber: '',
          steelCode: ''
        };
      }
    } catch {
      result = {
        manufacturer: '',
        productionDate: '',
        serialNumber: '',
        steelCode: ''
      };
    }

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
