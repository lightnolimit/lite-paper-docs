'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';

import { processLinks, processWalletAddresses } from '../utils/contentProcessor';
import logger from '../utils/logger';
import { processMarkdown, CodeBlockData } from '../utils/markdown-processor';

import CodeBlock from './CodeBlock';
import ColorPalette from './ColorPalette';

const componentLogger = logger;

interface MarkdownRendererProps {
  content: string;
  path: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [processedData, setProcessedData] = useState<{
    html: string;
    codeBlocks: Map<string, CodeBlockData[]>;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  // Process markdown content
  useEffect(() => {
    let isMounted = true;

    const processContent = async () => {
      try {
        setIsProcessing(true);
        componentLogger.debug('Processing markdown content');

        const result = await processMarkdown(content);

        if (isMounted) {
          setProcessedData(result);
          setIsProcessing(false);
        }
      } catch (error) {
        componentLogger.error('Error processing markdown:', error);
        if (isMounted) {
          setProcessedData({
            html: '<p>Error loading content. Please try again.</p>',
            codeBlocks: new Map(),
          });
          setIsProcessing(false);
        }
      }
    };

    if (content) {
      processContent();
    }

    return () => {
      isMounted = false;
    };
  }, [content]);

  // Process DOM after HTML is rendered
  useEffect(() => {
    if (!processedData || !contentRef.current) return;

    const currentRef = contentRef.current;

    // Process links and wallet addresses
    processLinks(currentRef);
    processWalletAddresses(currentRef);

    // Add click handlers for internal links
    const links = currentRef.querySelectorAll('a[href^="/docs/"]');
    const clickHandlers: Array<{ element: HTMLAnchorElement; handler: (e: MouseEvent) => void }> =
      [];

    links.forEach((rawLink) => {
      const link = rawLink as HTMLAnchorElement;
      const href = link.getAttribute('href');
      if (href) {
        const clickHandler = (e: MouseEvent) => {
          e.preventDefault();
          router.push(href);
        };
        link.addEventListener('click', clickHandler);
        clickHandlers.push({ element: link, handler: clickHandler });
      }
    });

    // Handle download links
    const downloadLinks = currentRef.querySelectorAll('a.download-link');
    downloadLinks.forEach((rawLink) => {
      const link = rawLink as HTMLAnchorElement;
      const file = link.getAttribute('data-file');
      if (file) {
        const clickHandler = (e: MouseEvent) => {
          e.preventDefault();
          const a = document.createElement('a');
          a.href = `/${file}`;
          a.download = file;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        link.addEventListener('click', clickHandler);
        clickHandlers.push({ element: link, handler: clickHandler });
      }
    });

    // Handle copy URL links
    const copyLinks = currentRef.querySelectorAll('a.copy-link');
    copyLinks.forEach((rawLink) => {
      const link = rawLink as HTMLAnchorElement;
      const url = link.getAttribute('data-url');
      if (url) {
        const clickHandler = async (e: MouseEvent) => {
          e.preventDefault();
          try {
            const fullUrl = window.location.origin + url;
            await navigator.clipboard.writeText(fullUrl);
            const originalText = link.textContent;
            link.textContent = '✓ Copied!';
            setTimeout(() => {
              link.textContent = originalText;
            }, 2000);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        };
        link.addEventListener('click', clickHandler);
        clickHandlers.push({ element: link, handler: clickHandler });
      }
    });

    // Cleanup function
    return () => {
      clickHandlers.forEach(({ element, handler }) => {
        element.removeEventListener('click', handler);
      });
    };
  }, [processedData, router]);

  // Render code blocks and color palettes in placeholders
  useEffect(() => {
    if (!processedData || !contentRef.current) return;

    // Handle code block placeholders
    const codeBlockPlaceholders = contentRef.current.querySelectorAll('[data-codeblock-id]');

    codeBlockPlaceholders.forEach((placeholder) => {
      const blockId = placeholder.getAttribute('data-codeblock-id');
      if (blockId && processedData.codeBlocks.has(blockId)) {
        const snippets = processedData.codeBlocks.get(blockId)!;

        // Create a container for the React component
        const container = document.createElement('div');
        placeholder.parentNode?.replaceChild(container, placeholder);

        // Use createRoot for React 18+
        import('react-dom/client')
          .then(({ createRoot }) => {
            const root = createRoot(container);
            root.render(<CodeBlock snippets={snippets} showLineNumbers={true} className="my-6" />);
          })
          .catch(() => {
            // This fallback should not be needed for React 18+ but just in case
            console.warn('Could not load React 18 createRoot, this should not happen');
          });
      }
    });

    // Handle color palette placeholders
    const colorPalettePlaceholders = contentRef.current.querySelectorAll('[data-colorpalette-id]');

    colorPalettePlaceholders.forEach((placeholder) => {
      const paletteData = placeholder.getAttribute('data-palette');
      if (paletteData) {
        try {
          const parsedData = JSON.parse(paletteData);

          // Create a container for the React component
          const container = document.createElement('div');
          placeholder.parentNode?.replaceChild(container, placeholder);

          // Use createRoot for React 18+
          import('react-dom/client')
            .then(({ createRoot }) => {
              const root = createRoot(container);
              root.render(<ColorPalette colors={parsedData.colors} />);
            })
            .catch(() => {
              console.warn('Could not load React 18 createRoot, this should not happen');
            });
        } catch (error) {
          console.error('Error parsing color palette data:', error);
        }
      }
    });
  }, [processedData]);

  if (isProcessing) {
    return (
      <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 1 }} className="w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
        </div>
      </motion.div>
    );
  }

  if (!processedData) {
    return (
      <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 1 }} className="w-full">
        <p className="text-gray-500 dark:text-gray-400">No content available.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0.9, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full"
    >
      <div
        ref={contentRef}
        className="markdown-content prose prose-gray dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: processedData.html }}
      />
    </motion.div>
  );
};

export default MarkdownRenderer;
