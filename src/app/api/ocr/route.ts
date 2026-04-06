import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

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

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config({ timeout: 30000 }); // 30秒超时
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: 'system' as const,
        content: '你是一个专业的OCR识别助手。请从图片中准确提取以下字段信息：\n1. 生产厂家\n2. 生产日期\n3. 出厂编号\n4. 企业钢码\n\n请以JSON格式返回结果，字段名必须使用中文（"生产厂家"、"生产日期"、"出厂编号"、"企业钢码"）。如果某个字段在图片中找不到，请返回空字符串。'
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: '请识别这张图片并提取以下信息：生产厂家、生产日期、出厂编号、企业钢码'
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: dataUri,
              detail: 'low' as const // 降低图片质量以加快速度
            }
          }
        ]
      }
    ];

    const response = await Promise.race([
      client.invoke(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.3
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时')), 60000) // 增加到60秒超时
      )
    ]);

    const content = (response as any).content;

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
