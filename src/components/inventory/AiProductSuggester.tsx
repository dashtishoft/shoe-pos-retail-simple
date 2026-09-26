import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Upload,
  Link as LinkIcon,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Tag,
  FolderPlus,
  Type,
  CheckCheck,
  Eye,
  Copy,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import type {
  AiProductSuggestionResult,
  AiConfidenceLevel,
  Brand,
  Category,
} from '../../types.ts';

interface AiProductSuggesterProps {
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  brands?: Brand[] | string[] | any[];
  categories?: Category[] | string[] | any[];
  onSelectBrand: (brandName: string) => void;
  onSelectCategory: (categoryName: string) => void;
  onSetTitle: (title: string) => void;
  onBrandsUpdated?: (updatedBrands: any[]) => void;
  onCategoriesUpdated?: (updatedCategories: any[]) => void;
}

// Sample shoe images including footwear categories and non-shoe guardrail alert test
const SAMPLE_SHOE_IMAGES = [
  {
    name: 'Sneakers (Nike)',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Loafers (Oxford)',
    url: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Boots',
    url: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=500&auto=format&fit=crop&q=80',
  },
  {
    name: 'Non-Shoe (Alert Test)',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
  },
];

export const AiProductSuggester: React.FC<AiProductSuggesterProps> = ({
  imageUrl,
  onImageUrlChange,
  brands,
  categories,
  onSelectBrand,
  onSelectCategory,
  onSetTitle,
  onBrandsUpdated,
  onCategoriesUpdated,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AiProductSuggestionResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  // Track applied states
  const [appliedBrand, setAppliedBrand] = useState(false);
  const [appliedCategory, setAppliedCategory] = useState(false);
  const [appliedTitle, setAppliedTitle] = useState(false);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper for status notice
  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Convert File to compressed base64 data URL
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file (PNG, JPG, WebP).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800; // Optimal resolution for Gemini visual analysis
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load selected image.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setAnalysisError(null);
        const dataUrl = await processImageFile(file);
        onImageUrlChange(dataUrl);
        // Reset applied flags
        setAppliedBrand(false);
        setAppliedCategory(false);
        setAppliedTitle(false);
        setSuggestion(null);
      } catch (err: any) {
        setAnalysisError(err.message || 'Failed to process image file.');
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      try {
        setAnalysisError(null);
        const dataUrl = await processImageFile(file);
        onImageUrlChange(dataUrl);
        setAppliedBrand(false);
        setAppliedCategory(false);
        setAppliedTitle(false);
        setSuggestion(null);
      } catch (err: any) {
        setAnalysisError(err.message || 'Failed to process dropped image.');
      }
    }
  };

  const handleApplyUrl = () => {
    if (customUrl.trim()) {
      onImageUrlChange(customUrl.trim());
      setShowUrlInput(false);
      setCustomUrl('');
      setAppliedBrand(false);
      setAppliedCategory(false);
      setAppliedTitle(false);
      setSuggestion(null);
      setAnalysisError(null);
    }
  };

  const handleRemoveImage = () => {
    onImageUrlChange('');
    setSuggestion(null);
    setAnalysisError(null);
    setAppliedBrand(false);
    setAppliedCategory(false);
    setAppliedTitle(false);
  };

  // Perform AI analysis
  const runAiAnalysis = async (targetImage?: string) => {
    const img = targetImage || imageUrl;
    if (!img || !img.trim()) {
      setAnalysisError('Please upload or provide a shoe image before running AI Suggest.');
      return;
    }

    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAppliedBrand(false);
    setAppliedCategory(false);
    setAppliedTitle(false);

    try {
      const res = await api.products.aiSuggest(img.trim());
      if (res && res.suggestion) {
        setSuggestion(res.suggestion);
      } else {
        throw new Error('No suggestions returned by AI model.');
      }
    } catch (err: any) {
      console.error('AI Suggestion error:', err);
      const errMsg = String(err?.message || err || '');
      if (
        errMsg.includes('not a valid footwear image') ||
        errMsg.toLowerCase().includes('not a valid footwear image') ||
        errMsg.startsWith('Alert:')
      ) {
        setAnalysisError('Alert: Image is not a valid footwear image. Please upload an image of a shoe.');
      } else {
        setAnalysisError(errMsg || 'Failed to analyze product image. Please check your network and try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply Brand Handler
  const handleApplyBrand = (brandData?: any) => {
    const data = brandData || suggestion?.brand;
    if (!data) return;

    const brandName = data.matchedName || data.suggestedName || (data.isUnknown ? 'Local' : 'Local');
    onSelectBrand(brandName);
    setAppliedBrand(true);
    triggerNotice(`Applied Brand: "${brandName}"`);
  };

  // Apply Category Handler
  const handleApplyCategory = (catData?: any) => {
    const data = catData || suggestion?.category;
    if (!data) return;

    const catName = data.matchedName || data.suggestedName || 'Casual Shoes';
    onSelectCategory(catName);
    setAppliedCategory(true);
    triggerNotice(`Applied Category: "${catName}"`);
  };

  // Apply Title Handler
  const handleApplyTitle = () => {
    if (suggestion?.title) {
      onSetTitle(suggestion.title);
      setAppliedTitle(true);
      triggerNotice(`Applied Product Title: "${suggestion.title}"`);
    }
  };

  // Apply All Handler
  const handleApplyAll = () => {
    if (!suggestion) return;

    // Apply title first
    if (suggestion.title) {
      onSetTitle(suggestion.title);
      setAppliedTitle(true);
    }

    // Apply brand
    if (suggestion.brand) {
      handleApplyBrand(suggestion.brand);
    }

    // Apply category
    if (suggestion.category) {
      handleApplyCategory(suggestion.category);
    }

    triggerNotice('Applied All suggestions: Brand, Category, and Title!');
  };

  // Confidence badge renderer
  const renderConfidenceBadge = (level: AiConfidenceLevel) => {
    const config = {
      HIGH: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60 shadow-xs dark:shadow-[0_0_12px_rgba(16,185,129,0.25)]',
        dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
        label: 'High confidence',
      },
      MEDIUM: {
        bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/60',
        dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]',
        label: 'Medium confidence',
      },
      LOW: {
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400',
        label: 'Low confidence',
      },
    }[level] || {
      bg: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
      dot: 'bg-gray-400',
      label: 'Medium confidence',
    };

    return (
      <span
        id="ai-confidence-badge"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.bg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  };

  return (
    <div id="ai-product-suggester-container" className="space-y-3">
      {/* Upload Zone & Controls */}
      <div className="bg-slate-50/80 dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 border border-slate-200 dark:border-[#1A263D] rounded-2xl p-4 space-y-3.5 shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-white">
                Product Image &amp; Visual AI
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Upload shoe photo or paste URL to automatically detect Brand, Category &amp; Title
              </p>
            </div>
          </div>

          {/* AI Suggest Button/Chip near Image Upload Area */}
          <button
            type="button"
            id="btn-ai-suggest"
            onClick={() => runAiAnalysis()}
            disabled={isAnalyzing || !imageUrl}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all ${
              !imageUrl
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-transparent'
                : isAnalyzing
                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 cursor-wait border border-indigo-200 dark:border-indigo-800'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-600 text-white shadow-md shadow-indigo-500/25 border border-purple-400/30 active:scale-95'
            }`}
            title={!imageUrl ? 'Upload or select an image first' : 'Analyze shoe image with AI'}
          >
            {isAnalyzing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            )}
            <span>{isAnalyzing ? 'Analyzing...' : 'AI Suggest'}</span>
          </button>
        </div>

        {/* Dropzone & Preview Area */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Left / Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`sm:col-span-8 border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-indigo-600 dark:border-blue-500 bg-indigo-50/50 dark:bg-blue-950/20'
                : 'border-slate-300 dark:border-slate-700/80 hover:border-indigo-600 dark:hover:border-blue-500 bg-white dark:bg-[#070B14]/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Upload className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
              <span className="font-semibold text-indigo-600 dark:text-blue-400 hover:underline">Choose image file</span>
              <span className="text-slate-400 dark:text-slate-500">or drag &amp; drop</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">PNG, JPG, or WebP</p>
          </div>

          {/* Right / Image Preview */}
          <div className="sm:col-span-4 flex items-center justify-center">
            {imageUrl ? (
              <div className="relative w-full h-20 bg-white dark:bg-[#070B14] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden group flex items-center justify-center shadow-2xs">
                <img
                  src={imageUrl}
                  alt="Product preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-1"
                  onError={() => setAnalysisError('Failed to load image preview. Check URL or file format.')}
                />
                <button
                  type="button"
                  id="btn-remove-image"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  className="cursor-pointer absolute top-1 right-1 bg-slate-900/70 hover:bg-red-600 text-white p-1 rounded-full opacity-80 hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="w-full h-20 bg-white dark:bg-[#070B14]/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                <span>No image</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Preview appears here</span>
              </div>
            )}
          </div>
        </div>

        {/* Secondary: URL Toggle & Quick Sample Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-800/80 text-[11px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-toggle-url-input"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-blue-400 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <LinkIcon className="w-3 h-3" />
              <span>{showUrlInput ? 'Hide URL field' : 'Or paste image URL'}</span>
            </button>
          </div>

          {/* Quick sample chips for testing */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 text-[10px]">Sample shoes:</span>
            {SAMPLE_SHOE_IMAGES.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                id={`btn-sample-image-${idx}`}
                onClick={() => {
                  onImageUrlChange(sample.url);
                  setSuggestion(null);
                  setAnalysisError(null);
                  setAppliedBrand(false);
                  setAppliedCategory(false);
                  setAppliedTitle(false);
                }}
                className="cursor-pointer px-2 py-0.5 rounded-md bg-white dark:bg-[#0B101D] border border-slate-200 dark:border-slate-700/80 hover:border-indigo-600 dark:hover:border-blue-400 hover:text-indigo-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-300 text-[10px] transition-colors shadow-2xs"
              >
                {sample.name}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible URL Input */}
        {showUrlInput && (
          <div className="flex gap-2 items-center pt-1">
            <input
              type="url"
              id="input-image-url"
              placeholder="https://images.unsplash.com/photo-..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyUrl();
                }
              }}
              className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-[#070B14] text-slate-800 dark:text-white outline-none focus:border-indigo-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-indigo-100 dark:focus:ring-blue-950"
            />
            <button
              type="button"
              id="btn-apply-image-url"
              onClick={handleApplyUrl}
              className="cursor-pointer px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white text-xs font-semibold border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 active:scale-95"
            >
              Set URL
            </button>
          </div>
        )}
      </div>

      {/* Action Toast / Feedback Notice */}
      {actionNotice && (
        <div
          id="ai-action-notice"
          className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 px-3 py-2 rounded-lg text-xs flex items-center gap-2 animate-fadeIn shadow-2xs"
        >
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Loading State: Exact mandated string "AI is analyzing product image..." */}
      {isAnalyzing && (
        <div
          id="ai-loading-state"
          className="bg-indigo-50/70 dark:bg-gradient-to-b dark:from-[#131B2E] dark:to-[#0A0E1A] border border-indigo-200 dark:border-blue-500/30 rounded-xl p-4 flex items-center justify-center gap-3 text-indigo-900 dark:text-blue-200 shadow-sm dark:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
        >
          <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-blue-400 animate-spin flex-shrink-0" />
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-slate-800 dark:text-white">
              AI is analyzing product image...
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Inspecting brand logos, footwear silhouette, materials, and categories
            </p>
          </div>
        </div>
      )}

      {/* Error / Alert State with Retry Button */}
      {analysisError && !isAnalyzing && (
        <div
          id="ai-error-state"
          className={`border-2 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs ${
            analysisError.includes('not a valid footwear image') || analysisError.startsWith('Alert:')
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700/60 text-amber-950 dark:text-amber-200'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-700/60 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {analysisError.includes('not a valid footwear image') || analysisError.startsWith('Alert:') ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                {analysisError.includes('not a valid footwear image') || analysisError.startsWith('Alert:')
                  ? 'Strict Shoe Validation Notice'
                  : 'Image Analysis Error'}
              </p>
              <p className="text-xs font-mono font-semibold bg-white/90 border border-amber-300 px-2.5 py-1.5 rounded-lg text-amber-950">
                {analysisError}
              </p>
              {analysisError.includes('not a valid footwear image') && (
                <p className="text-[11px] text-amber-800/90 pt-0.5">
                  The AI assistant is specialized exclusively in footwear analysis. Please upload an image of a shoe (sneakers, boots, sandals, heels, dress shoes).
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            id="btn-retry-ai-suggest"
            onClick={() => runAiAnalysis()}
            className="cursor-pointer self-end sm:self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shrink-0 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* AI Suggestions Results Panel */}
      {suggestion && !isAnalyzing && (
        <div
          id="ai-suggestions-panel"
          className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/95 dark:to-[#0A0E1A]/90 border-2 border-indigo-200/80 dark:border-blue-500/30 rounded-2xl p-4.5 shadow-sm dark:shadow-[0_0_25px_rgba(59,130,246,0.1)] space-y-3.5"
        >
          {/* Panel Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-blue-950/60 text-indigo-600 dark:text-blue-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Footwear AI Analysis
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {renderConfidenceBadge(suggestion.confidence)}

              {/* Prominent "Apply All" Button */}
              <button
                type="button"
                id="btn-apply-all-suggestions"
                onClick={handleApplyAll}
                disabled={isCreatingBrand || isCreatingCategory}
                className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-600 text-white text-xs font-bold shadow-md shadow-indigo-500/25 border border-purple-400/30 transition-all active:scale-95"
              >
                <CheckCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>Apply All</span>
              </button>
            </div>
          </div>

          {/* Structured Output Card (Exact Mandated Output Format) */}
          <div
            id="ai-structured-output-card"
            className="bg-slate-900 dark:bg-[#070B14] text-slate-100 rounded-xl p-3.5 font-mono text-xs space-y-2 border border-slate-800 dark:border-[#1A263D] shadow-inner"
          >
            <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 border-b border-slate-800 pb-1.5">
              <span className="font-semibold text-slate-300 dark:text-slate-300">Mandated Footwear Output Format</span>
              <button
                type="button"
                id="btn-copy-structured-output"
                onClick={() => {
                  const textToCopy = `Brand Name: ${suggestion.brand.suggestedName}\n\nCategory: ${suggestion.category.suggestedName}\n\nSuggested Title: ${suggestion.title}`;
                  navigator.clipboard?.writeText(textToCopy);
                  triggerNotice('Copied structured output to clipboard!');
                }}
                className="cursor-pointer inline-flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 dark:bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors"
                title="Copy exact output text"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Format</span>
              </button>
            </div>
            <div className="space-y-1.5 pt-0.5">
              <p>
                <span className="text-indigo-300 dark:text-blue-300 font-semibold">Brand Name:</span>{' '}
                <span className="text-white font-medium">{suggestion.brand.suggestedName}</span>
              </p>
              <p>
                <span className="text-indigo-300 dark:text-blue-300 font-semibold">Category:</span>{' '}
                <span className="text-emerald-400 font-medium">{suggestion.category.suggestedName}</span>
              </p>
              <p>
                <span className="text-indigo-300 dark:text-blue-300 font-semibold">Suggested Title:</span>{' '}
                <span className="text-amber-300 font-medium">{suggestion.title}</span>
              </p>
            </div>
          </div>

          {/* 3 Mandated Suggestion Rows: Brand, Category, Title */}
          <div className="space-y-2.5">
            {/* 1. Brand Row */}
            <div
              id="ai-brand-suggestion-row"
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                appliedBrand
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-700/50'
                  : 'bg-slate-50/70 dark:bg-[#070B14]/80 border-slate-200/90 dark:border-[#1A263D] hover:bg-slate-50 dark:hover:bg-[#0E1628]'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
                <Tag className="w-4 h-4 text-indigo-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Brand Name:</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {suggestion.brand.suggestedName}
                    </span>
                    {suggestion.brand.isUnknown && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium">
                        Not clearly visible
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {suggestion.brand.isExisting ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        ✓ Matches existing store brand &ldquo;{suggestion.brand.matchedName}&rdquo;
                      </span>
                    ) : suggestion.brand.isUnknown ? (
                      <span className="text-slate-500 dark:text-slate-400">
                        Brand trademark not identifiable with certainty
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        ✦ New brand &mdash; will be created in catalog
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual "Apply Brand" Chip/Button */}
              <button
                type="button"
                id="btn-apply-brand"
                onClick={() => handleApplyBrand()}
                disabled={isCreatingBrand}
                className={`cursor-pointer inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  appliedBrand
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-white dark:bg-[#131B2E] hover:bg-indigo-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-blue-400 border border-slate-300 dark:border-slate-700 hover:border-indigo-600 dark:hover:border-blue-500 shadow-2xs'
                }`}
              >
                {appliedBrand ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                <span>{appliedBrand ? 'Applied ✓' : isCreatingBrand ? 'Creating...' : 'Apply Brand'}</span>
              </button>
            </div>

            {/* 2. Category Row */}
            <div
              id="ai-category-suggestion-row"
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                appliedCategory
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-700/50'
                  : 'bg-slate-50/70 dark:bg-[#070B14]/80 border-slate-200/90 dark:border-[#1A263D] hover:bg-slate-50 dark:hover:bg-[#0E1628]'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
                <FolderPlus className="w-4 h-4 text-indigo-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Category:</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {suggestion.category.suggestedName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded font-medium">
                      Single Footwear Category
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {suggestion.category.isExisting ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        ✓ Matches existing category &ldquo;{suggestion.category.matchedName}&rdquo;
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        ✦ New category &mdash; will be created in catalog
                      </span>
                    )}
                    <span className="text-slate-400 dark:text-slate-500 ml-1">
                      (Restricted to Footwear Categories)
                    </span>
                  </div>

                  {/* Sandal Distinction Switcher (Men vs Women Flat vs Women Heeled) */}
                  {(suggestion.category.suggestedName.toLowerCase().includes('sandal') ||
                    suggestion.category.suggestedName.toLowerCase().includes('chappal') ||
                    suggestion.title.toLowerCase().includes('sandal') ||
                    suggestion.title.toLowerCase().includes('chappal') ||
                    suggestion.title.toLowerCase().includes('slide')) && (
                    <div className="mt-2 pt-2 border-t border-indigo-100/70 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500 dark:text-blue-400" />
                        Sandal Type Switcher:
                      </span>
                      {[
                        { label: "Men's Sandals & Chappals", cat: 'Sandals & Chappals' },
                        { label: "Women's Flat Sandals", cat: 'Flat Sandals' },
                        { label: "Women's Heeled Sandals", cat: 'Heeled Sandals' },
                      ].map((item) => {
                        const isSelected = suggestion.category.suggestedName === item.cat;
                        return (
                          <button
                            key={item.cat}
                            type="button"
                            onClick={() => {
                              const matched = categories.find((c) => c.name.toLowerCase() === item.cat.toLowerCase());
                              const newCatData = {
                                suggestedName: item.cat as any,
                                matchedId: matched?.id || null,
                                matchedName: matched?.name || null,
                                isExisting: !!matched,
                                confidence: 'HIGH' as const,
                              };
                              setSuggestion({
                                ...suggestion,
                                category: newCatData,
                              });
                              handleApplyCategory(newCatData);
                            }}
                            className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-xs'
                                : 'bg-white dark:bg-[#0E1628] hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500'
                            }`}
                          >
                            {item.label} {isSelected ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Individual "Apply Category" Chip/Button */}
              <button
                type="button"
                id="btn-apply-category"
                onClick={() => handleApplyCategory()}
                disabled={isCreatingCategory}
                className={`cursor-pointer inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  appliedCategory
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-white dark:bg-[#131B2E] hover:bg-indigo-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-blue-400 border border-slate-300 dark:border-slate-700 hover:border-indigo-600 dark:hover:border-blue-500 shadow-2xs'
                }`}
              >
                {appliedCategory ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                <span>{appliedCategory ? 'Applied ✓' : isCreatingCategory ? 'Creating...' : 'Apply Category'}</span>
              </button>
            </div>

            {/* 3. Product Title Row */}
            <div
              id="ai-title-suggestion-row"
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                appliedTitle
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-700/50'
                  : 'bg-slate-50/70 dark:bg-[#070B14]/80 border-slate-200/90 dark:border-[#1A263D] hover:bg-slate-50 dark:hover:bg-[#0E1628]'
              }`}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-2">
                <Type className="w-4 h-4 text-indigo-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Suggested Title:</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white break-words">
                      {suggestion.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 dark:bg-blue-950/40 text-indigo-700 dark:text-blue-300 border border-indigo-200 dark:border-blue-800/50 rounded font-medium">
                      Color-free Silhouette / Model
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Colors &amp; generic descriptors removed • Focused strictly on brand, model, and style line
                  </div>
                </div>
              </div>

              {/* Individual "Apply Title" Chip/Button */}
              <button
                type="button"
                id="btn-apply-title"
                onClick={handleApplyTitle}
                className={`cursor-pointer inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  appliedTitle
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-300 hover:border-indigo-600 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
                }`}
              >
                {appliedTitle ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                <span>{appliedTitle ? 'Applied ✓' : 'Apply Title'}</span>
              </button>
            </div>
          </div>

          {/* Visual Clues / AI Observations Details */}
          {suggestion.visualClues && suggestion.visualClues.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <Eye className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <span>Detected Visual Clues:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.visualClues.map((clue, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#070B14] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[10px]"
                  >
                    {clue}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
