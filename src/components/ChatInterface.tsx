import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Bot, User, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../store/settings';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    assets?: any[]; // Added assets property
}

export const ChatInterface: React.FC = () => {
    const { isChatOpen, toggleChat } = useSettingsStore();
    const setViewingAssetId = useStore(state => state.setViewingAssetId); // Added setViewingAssetId
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your smart assistant. I can help you find assets or answer questions about your library. (Powered by CLIP)",
            timestamp: Date.now()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isChatOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // @ts-ignore
            const response = await window.ipcRenderer.invoke('chat-message', userMessage.content);

            const assistantMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: response.message || "I'm not sure how to respond to that.",
                timestamp: Date.now(),
                assets: response.assets // Added assets to assistantMessage
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, {
                id: uuidv4(),
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <AnimatePresence>
            {isChatOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed bottom-4 right-4 w-[350px] h-[500px] bg-background border border-border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-primary/10 rounded-full">
                                <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-semibold text-sm">Smart Assistant</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleChat}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col gap-2 max-w-[85%]",
                                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div className={cn(
                                    "flex gap-2",
                                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                )}>
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1",
                                        msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                        {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className={cn(
                                        "rounded-lg px-3 py-2 text-sm",
                                        msg.role === 'user'
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-foreground"
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>

                                {/* Asset Results */}
                                {msg.assets && msg.assets.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mt-1 ml-8 w-full">
                                        {msg.assets.map((asset: any) => (
                                            <div
                                                key={asset.id}
                                                className="relative aspect-square rounded-md overflow-hidden border border-border cursor-pointer hover:ring-2 ring-primary transition-all group"
                                                onClick={() => setViewingAssetId(asset.id)}
                                            >
                                                <img
                                                    src={asset.thumbnailPath ? `thumbnail://${asset.thumbnailPath}` : `media://${asset.path}`}
                                                    alt={asset.path}
                                                    className="w-full h-full object-cover"
                                                />
                                                {asset.type === 'video' && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10">
                                                        <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                            <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[6px] border-l-white border-b-[3px] border-b-transparent ml-0.5" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-2 mr-auto max-w-[85%]">
                                <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-1">
                                    <Bot className="w-3.5 h-3.5" />
                                </div>
                                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                                    <span className="animate-pulse">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-border bg-background">
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                className="flex-1"
                                disabled={isLoading}
                            />
                            <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
