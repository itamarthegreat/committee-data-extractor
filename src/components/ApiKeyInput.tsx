import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Key } from 'lucide-react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
}

const ApiKeyInput = ({ value, onChange }: ApiKeyInputProps) => {
  const [showKey, setShowKey] = useState(false);
  const [localKey, setLocalKey] = useState(value);

  // Load from localStorage on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      setLocalKey(savedKey);
      onChange(savedKey);
    }
  }, [onChange]);

  const handleChange = (newValue: string) => {
    setLocalKey(newValue);
    onChange(newValue);
  };

  const clearKey = () => {
    setLocalKey('');
    onChange('');
    localStorage.removeItem('openai_api_key');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-primary" />
        <Label htmlFor="api-key" className="font-medium">
          מפתח OpenAI API
        </Label>
      </div>
      
      <div className="relative">
        <Input
          id="api-key"
          type={showKey ? "text" : "password"}
          placeholder="sk-..."
          value={localKey}
          onChange={(e) => handleChange(e.target.value)}
          className="pr-20"
          dir="ltr"
        />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowKey(!showKey)}
            className="h-8 w-8 p-0"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          המפתח נשמר באופן מקומי בדפדפן שלך ואינו נשלח לשרתים חיצוניים
        </p>
        
        {localKey && (
          <div className="flex items-center justify-between p-2 bg-success-light rounded-md">
            <span className="text-xs text-success-foreground font-medium">
              מפתח API הוזן בהצלחה
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearKey}
              className="h-6 text-xs hover:text-destructive"
            >
              נקה
            </Button>
          </div>
        )}
        
        {!localKey && (
          <div className="p-2 bg-warning-light rounded-md">
            <p className="text-xs text-warning-foreground">
              נדרש מפתח API של OpenAI כדי להשתמש במערכת
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyInput;