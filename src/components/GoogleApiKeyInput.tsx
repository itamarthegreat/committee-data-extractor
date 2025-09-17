import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Key } from "lucide-react";

interface GoogleApiKeyInputProps {
  onApiKeyChange: (key: string) => void;
}

const GoogleApiKeyInput: React.FC<GoogleApiKeyInputProps> = ({ onApiKeyChange }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isStored, setIsStored] = useState(false);

  useEffect(() => {
    // Check if API key is already stored
    const storedKey = localStorage.getItem('googleCloudApiKey');
    if (storedKey) {
      setApiKey(storedKey);
      setIsStored(true);
      onApiKeyChange(storedKey);
    }
  }, [onApiKeyChange]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('googleCloudApiKey', apiKey.trim());
      setIsStored(true);
      onApiKeyChange(apiKey.trim());
    }
  };

  const handleClear = () => {
    localStorage.removeItem('googleCloudApiKey');
    setApiKey('');
    setIsStored(false);
    onApiKeyChange('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Google Cloud Vision API
        </CardTitle>
        <CardDescription>
          הוסף מפתח API לשיפור איכות OCR עבור עברית
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="google-api-key">Google Cloud API Key</Label>
          <div className="relative">
            <Input
              id="google-api-key"
              type={showKey ? "text" : "password"}
              placeholder="הזן את מפתח ה-API שלך..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1"
          >
            {isStored ? 'עדכן מפתח' : 'שמור מפתח'}
          </Button>
          
          {isStored && (
            <Button
              onClick={handleClear}
              variant="outline"
            >
              מחק
            </Button>
          )}
        </div>

        {isStored && (
          <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
            ✅ מפתח Google API נשמר - OCR מתקדם זמין
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>איך לקבל מפתח API:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mr-4">
            <li>היכנס ל-<a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
            <li>צור פרויקט חדש או בחר קיים</li>
            <li>הפעל את Vision API</li>
            <li>ב-"Credentials" צור API Key</li>
            <li>העתק את המפתח כאן</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleApiKeyInput;