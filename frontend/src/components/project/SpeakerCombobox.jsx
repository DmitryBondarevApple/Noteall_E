import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { speakerDirectoryApi } from '../../lib/api';
import { User, Plus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SpeakerCombobox({ value, onChange, onAddToDirectory, placeholder = "Введите имя..." }) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await speakerDirectoryApi.list(inputValue);
        setSuggestions(res.data);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Update input when value prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleSelect = useCallback((speaker) => {
    const displayName = speaker.company
      ? `${speaker.name} (${speaker.company})`
      : speaker.name;
    setInputValue(displayName);
    onChange(displayName);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onChange]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleInputBlur = () => {
    // Delay closing to allow click on suggestion
    setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onChange(inputValue.trim());
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        } else {
          onChange(inputValue.trim());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleAddToDirectory = async () => {
    if (!inputValue.trim()) return;
    
    try {
      // Parse "Name (Company)" format
      const trimmed = inputValue.trim();
      const companyMatch = trimmed.match(/^(.+?)\s*\((.+?)\)\s*$/);
      
      const createData = companyMatch
        ? { name: companyMatch[1].trim(), company: companyMatch[2].trim() }
        : { name: trimmed };
      
      const res = await speakerDirectoryApi.create(createData);
      toast.success(`${res.data.name} добавлен в справочник`);
      onChange(trimmed);
      setIsOpen(false);
      onAddToDirectory?.(res.data);
    } catch (error) {
      toast.error('Ошибка добавления в справочник');
    }
  };

  const exactMatch = suggestions.some(s => {
    const input = inputValue.toLowerCase().trim();
    // Direct name match
    if (s.name.toLowerCase() === input) return true;
    // Full display "Name (Company)" match
    if (s.company) {
      const display = `${s.name} (${s.company})`.toLowerCase();
      if (display === input) return true;
    }
    // Parse input "Name (Company)" and match name part only
    const m = input.match(/^(.+?)\s*\((.+?)\)\s*$/);
    if (m && s.name.toLowerCase() === m[1].trim()) return true;
    return false;
  });
  const showAddButton = inputValue.trim() && !exactMatch && !loading;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.trim() && setIsOpen(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pr-8"
          data-testid="speaker-combobox-input"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (suggestions.length > 0 || showAddButton) && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg">
          {suggestions.length > 0 && (
            <ScrollArea className="max-h-48">
              <div className="py-1" ref={listRef}>
                {suggestions.map((speaker, index) => (
                  <button
                    key={speaker.id}
                    type="button"
                    className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                      index === highlightedIndex ? 'bg-slate-100' : ''
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur before click
                      handleSelect(speaker);
                    }}
                    data-testid={`speaker-suggestion-${speaker.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{speaker.name}</div>
                      {(speaker.role || speaker.company) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[speaker.role, speaker.company].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </div>
                    {speaker.name.toLowerCase() === inputValue.toLowerCase().trim() && (
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {showAddButton && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  handleAddToDirectory();
                }}
                data-testid="add-to-directory-btn"
              >
                <Plus className="w-4 h-4" />
                Добавить «{inputValue.trim()}» в справочник
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
