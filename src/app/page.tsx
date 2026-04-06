'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, FileImage, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface OCRResult {
  fileName: string;
  manufacturer: string;
  productionDate: string;
  serialNumber: string;
  steelCode: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

export default function OCRPage() {
  const [images, setImages] = useState<File[]>([]);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);

    const newResults: OCRResult[] = files.map(file => ({
      fileName: file.name,
      manufacturer: '',
      productionDate: '',
      serialNumber: '',
      steelCode: '',
      status: 'pending',
    }));

    setResults(prev => [...prev, ...newResults]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );
    setImages(prev => [...prev, ...files]);

    const newResults: OCRResult[] = files.map(file => ({
      fileName: file.name,
      manufacturer: '',
      productionDate: '',
      serialNumber: '',
      steelCode: '',
      status: 'pending',
    }));

    setResults(prev => [...prev, ...newResults]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setResults(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setImages([]);
    setResults([]);
  }, []);

  const processOCR = useCallback(async () => {
    if (images.length === 0) return;

    setIsProcessing(true);

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      try {
        setResults(prev =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'processing' as const } : r
          )
        );

        const formData = new FormData();
        formData.append('image', image);

        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('OCR识别失败');
        }

        const data = await response.json();

        setResults(prev =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  manufacturer: data.manufacturer || '',
                  productionDate: data.productionDate || '',
                  serialNumber: data.serialNumber || '',
                  steelCode: data.steelCode || '',
                  status: 'success' as const,
                }
              : r
          )
        );
      } catch (error) {
        setResults(prev =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: 'error' as const,
                  errorMessage: error instanceof Error ? error.message : '未知错误',
                }
              : r
          )
        );
      }
    }

    setIsProcessing(false);
  }, [images]);

  const exportToExcel = useCallback(() => {
    const exportData = results
      .filter(r => r.status === 'success')
      .map(r => ({
        '文件名': r.fileName,
        '生产厂家': r.manufacturer,
        '生产日期': r.productionDate,
        '出厂编号': r.serialNumber,
        '企业钢码': r.steelCode,
      }));

    if (exportData.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OCR识别结果');

    XLSX.writeFile(wb, `OCR识别结果_${new Date().toLocaleDateString('zh-CN')}.xlsx`);
  }, [results]);

  const getStatusIcon = (status: OCRResult['status']) => {
    switch (status) {
      case 'pending':
        return <FileImage className="h-5 w-5 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">批量图片OCR识别</CardTitle>
            <CardDescription>
              上传多张图片，AI自动提取生产厂家、生产日期、出厂编号、企业钢码等信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer mb-4"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                拖拽图片到此处，或点击选择文件
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>选择图片</span>
                </Button>
              </label>
            </div>

            {images.length > 0 && (
              <div className="flex gap-2 mb-4">
                <Button
                  onClick={processOCR}
                  disabled={isProcessing || results.some(r => r.status === 'processing')}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      识别中...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      开始识别 ({images.length}张)
                    </>
                  )}
                </Button>
                <Button onClick={clearAll} variant="outline">
                  清空
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(results[index]?.status || 'pending')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{image.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(image.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeImage(index)}
                      disabled={isProcessing}
                    >
                      移除
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>识别结果</CardTitle>
                <CardDescription>
                  成功: {results.filter(r => r.status === 'success').length} / 总计: {results.length}
                </CardDescription>
              </div>
              <Button
                onClick={exportToExcel}
                disabled={results.filter(r => r.status === 'success').length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                导出Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left p-2 font-medium">状态</th>
                      <th className="text-left p-2 font-medium">文件名</th>
                      <th className="text-left p-2 font-medium">生产厂家</th>
                      <th className="text-left p-2 font-medium">生产日期</th>
                      <th className="text-left p-2 font-medium">出厂编号</th>
                      <th className="text-left p-2 font-medium">企业钢码</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-2">{getStatusIcon(result.status)}</td>
                        <td className="p-2 max-w-[200px] truncate" title={result.fileName}>
                          {result.fileName}
                        </td>
                        <td className="p-2">{result.manufacturer || '-'}</td>
                        <td className="p-2">{result.productionDate || '-'}</td>
                        <td className="p-2">{result.serialNumber || '-'}</td>
                        <td className="p-2">{result.steelCode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
