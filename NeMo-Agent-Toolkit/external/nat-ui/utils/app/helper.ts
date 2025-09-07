import { v4 as uuidv4 } from 'uuid';
import { env } from 'next-runtime-env'
import { Message, Conversation, WebSocketMessage, SystemResponseMessage, SystemIntermediateMessage, SystemInteractionMessage, ErrorMessage } from '@/types/chat';
import { APPLICATION_NAME } from '@/constants/constants';
export const getInitials = (fullName = '') => {
    if (!fullName) {
        return "";
    }
    const initials = fullName.split(' ').map(name => name[0]).join('').toUpperCase();
    return initials;
}
export const compressImage = (base64: string, mimeType: string | undefined, shouldCompress: boolean, callback: { (compressedBase64: string): void; (arg0: string): void; }) => {
    const MAX_SIZE = 200 * 1024; // 200 KB maximum size
    const MIN_SIZE = 100 * 1024;  // 100 KB minimum size, to avoid under compression
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    if (!ctx) {
        callback(base64);
        return;
    }

    img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxSize = 800; // Start with a larger size for initial scaling

        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height *= maxSize / width;
                width = maxSize;
            } else {
                width *= maxSize / height;
                height = maxSize;
            }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;  // Start with high quality
        let newDataUrl = canvas.toDataURL(mimeType, quality);

        if (shouldCompress) {
            while (newDataUrl.length > MAX_SIZE && quality > 0.1) {
                quality -= 0.05; // Gradually reduce quality
                newDataUrl = canvas.toDataURL(mimeType, quality);
            }

            // Check if overly compressed, then adjust quality slightly back up
            while (newDataUrl.length < MIN_SIZE && quality <= 0.9) {
                quality += 0.05; // Increment quality slightly
                newDataUrl = canvas.toDataURL(mimeType, quality);
            }

            // Further dimension reduction if still too large
            while (newDataUrl.length > MAX_SIZE && (width > 50 || height > 50)) {
                width *= 0.75; // Reduce dimensions
                height *= 0.75;
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                newDataUrl = canvas.toDataURL(mimeType, quality);
            }
        }

        // console.log(`Original Base64 Size: ${base64.length / 1024} KB`);
        // console.log(`Compressed Base64 Size: ${newDataUrl.length / 1024} KB`);
        callback(newDataUrl);
    };

    img.src = base64;
}

export const getURLQueryParam = ({ param = '' }) => {
    // Get the URL query parameters safely
    const urlParams = new URLSearchParams(window?.location?.search);

    if (param) {
        // Get the value of a specific query parameter
        return urlParams.get(param);
    } else {
        // Get all query params safely
        const paramsObject = Object.create(null); // Prevent prototype pollution
        urlParams.forEach((value, key) => {
            if (Object.prototype.hasOwnProperty.call(paramsObject, key)) return; // Extra safety check
            paramsObject[key] = value;
        });
        return paramsObject;
    }
};


export const getWorkflowName = () => {
    const workflow = getURLQueryParam({ param: 'workflow' }) || env('NEXT_PUBLIC_WORKFLOW') || process?.env?.NEXT_PUBLIC_WORKFLOW || APPLICATION_NAME;
    return workflow
}

export const setSessionError = (message = 'unknown error') => {
    sessionStorage.setItem('error', 'true');
    sessionStorage.setItem('errorMessage', message);
}

export const removeSessionError = () => {
    sessionStorage.removeItem('error');
    sessionStorage.removeItem('errorMessage');
}

export const isInsideIframe = () => {
    try {
        return window?.self !== window?.top;
    } catch (e) {
        // If a security error occurs (cross-origin), assume it's in an iframe
        return true;
    }
};

export const fetchLastMessage = ({messages = [], role = 'user'}: {messages?: Message[], role?: string}): Message | null => {
    // Loop from the end to find the last message with the role "user"
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === role) {
            return messages[i];  // Return the content of the last user message
        }
    }
    return null;  // Return null if no user message is found
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface IntermediateStep {
    id?: string;
    parent_id?: string;
    index?: number;
    content?: any;
    intermediate_steps?: IntermediateStep[];
    [key: string]: any; // For any additional properties
}

export const processIntermediateMessage = (
    existingSteps: IntermediateStep[] = [],
    newMessage: IntermediateStep = {} as IntermediateStep,
    intermediateStepOverride = true
): IntermediateStep[] => {

    if (!newMessage.id) {
        return existingSteps;
    }

    // Helper function to find and replace a message in the steps tree
    const replaceMessage = (steps: IntermediateStep[]): boolean => {
        for (let i = 0; i < steps.length; i++) {
            if (steps[i].id === newMessage.id && steps[i].content?.name === newMessage.content?.name) {
                // Preserve the index when overriding
                steps[i] = {
                    ...newMessage,
                    index: steps[i].index
                };
                return true;
            }

            // Recursively check intermediate steps
            const intermediateSteps = steps[i].intermediate_steps;
            if (intermediateSteps && intermediateSteps.length > 0) {
                if (replaceMessage(intermediateSteps)) {
                    return true;
                }
            }
        }
        return false;
    };

    // Helper function to find a parent step by ID
    const findParentStep = (steps: IntermediateStep[], parentId: string): IntermediateStep | null => {
        for (const step of steps) {
            if (step.id === parentId) {
                return step;
            }
            const intermediateSteps = step.intermediate_steps;
            if (intermediateSteps && intermediateSteps.length > 0) {
                const found = findParentStep(intermediateSteps, parentId);
                if (found) return found;
            }
        }
        return null;
    };

    try {
        // If override is enabled and message exists, try to replace it
        if (intermediateStepOverride) {
            const wasReplaced = replaceMessage(existingSteps);
            if (wasReplaced) {
                return existingSteps;
            }
        }

        // If message wasn't replaced or override is disabled, add it to the appropriate place
        if (newMessage.parent_id) {
            const parentStep = findParentStep(existingSteps, newMessage.parent_id);
            if (parentStep) {
                // Initialize intermediate_steps array if it doesn't exist
                if (!parentStep.intermediate_steps) {
                    parentStep.intermediate_steps = [];
                }
                parentStep.intermediate_steps.push(newMessage);
                return existingSteps;
            }
        }

        // If no parent found or no parent_id, add to root level
        existingSteps.push(newMessage);
        return existingSteps;

    } catch (error) {
        return existingSteps;
    }
};

export const escapeHtml = (str: string): string => {
    try {
        if (typeof str !== 'string') {
            throw new TypeError('Input must be a string');
        }
        return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    } catch (error) {
        return ''; // Return an empty string in case of error
    }
};

export const convertBackticksToPreCode = (markdown = '') => {
    try {
        if (typeof markdown !== 'string') {
            throw new TypeError('Input must be a string');
        }

        // Step 1: Convert code blocks first
        markdown = markdown.replace(
            /```(\w+)?\n([\s\S]*?)\n```/g,
            (_, lang, code) => {
                const languageClass = lang ? ` class="language-${lang}"` : '';
                const escapedCode = escapeHtml(code);
                return `\n<pre><code${languageClass}>${escapedCode}</code></pre>\n`;
            }
        );

        // Step 2: Convert bold text **bold**
        markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        return markdown;
    } catch (error) {
        return markdown;
    }
};

export const generateContentIntermediate = (intermediateSteps: IntermediateStep[] = []): string => {
    const generateDetails = (data: IntermediateStep[]): string => {
        try {
            if (!Array.isArray(data)) {
                throw new TypeError('Input must be an array');
            }
            return data.map((item) => {
                const currentId = item.id;
                const currentIndex = item.index;
                const sanitizedPayload = convertBackticksToPreCode(item.content?.payload || '');
                let details = `<details id=${currentId} index=${currentIndex}>\n`;
                details += `  <summary id=${currentId}>${item.content?.name || ''}</summary>\n`;

                details += `\n${sanitizedPayload}\n`;

                if (item.intermediate_steps && item.intermediate_steps.length > 0) {
                    details += generateDetails(item.intermediate_steps);
                }

                details += `</details>\n`;
                return details;
            }).join('');
        } catch (error) {
            return ''; // Return an empty string in case of error
        }
    };

    try {
        if (!Array.isArray(intermediateSteps) || intermediateSteps.length === 0) {
            return '';
        }
        let intermediateContent = generateDetails(intermediateSteps);
        const firstStep = intermediateSteps[0];
        if (firstStep && firstStep.parent_id) {
            intermediateContent = `<details id=${uuidv4()} index="-1" ><summary id=${firstStep.parent_id}>Intermediate Steps</summary>\n${intermediateContent}</details>`;
        }
        if (/(?:\\)?```/.test(intermediateContent)) {
            intermediateContent = intermediateContent.replace(/\n{2,}/g, '\n');
        }
        return intermediateContent;
    } catch (error) {
        return '';
    }
};

export const replaceMalformedMarkdownImages = (str = '') => {
    return str.replace(/!\[.*?\]\(([^)]*)$/, (match) => {
        return `<img src="loading" alt="loading" style="max-width: 100%; height: 100%;" />`;
    });
}

export const replaceMalformedHTMLImages = (str = '') => {
    return str.replace(/<img\s+[^>]*$/, (match) => {
        return `<img src="loading" alt="loading" style="max-width: 100%; height: 100%;" />`;
    });
}

export const replaceMalformedHTMLVideos = (str = '') => {
    return str.replace(/<video\s+[^>]*$/, (match) => {
        return `<video controls width="400" height="200">
            <source src="loading" type="video/mp4">
            Your browser does not support the video tag.
        </video>`;
    });
}


export const fixMalformedHtml = (content = '') => {
    try {
        let fixed = replaceMalformedHTMLImages(content);
        fixed = replaceMalformedHTMLVideos(fixed);
        fixed = replaceMalformedMarkdownImages(fixed);
        return fixed;
    }
    catch (e) {
        return content; // Return original if fixing fails
    }
};

// ===== WebSocket Message Utilities =====

/**
 * Type guards for WebSocket messages
 */
export const isSystemResponseMessage = (message: any): message is SystemResponseMessage => {
    return message?.type === 'system_response_message';
};

export const isSystemIntermediateMessage = (message: any): message is SystemIntermediateMessage => {
    return message?.type === 'system_intermediate_message';
};

export const isSystemInteractionMessage = (message: any): message is SystemInteractionMessage => {
    return message?.type === 'system_interaction_message';
};

export const isErrorMessage = (message: any): message is ErrorMessage => {
    return message?.type === 'error';
};

/**
 * Validates that a WebSocket message has required fields
 */
export const validateWebSocketMessage = (message: any): message is WebSocketMessage => {
    return message &&
           typeof message === 'object' &&
           message.type &&
           message.conversation_id;
};

/**
 * Extracts OAuth URL from interaction message
 */
export const extractOAuthUrl = (message: SystemInteractionMessage): string | null => {
    const content = message.content;
    return content?.oauth_url || content?.redirect_url || content?.text || null;
};

/**
 * Determines if a system response message should append content
 * Only append for in_progress status with non-empty text
 */
export const shouldAppendResponseContent = (message: SystemResponseMessage): boolean => {
    return message.status === 'in_progress' &&
           !!message.content?.text?.trim();
};

/**
 * Creates a new assistant message from WebSocket data
 */
export const createAssistantMessage = (
    id: string | undefined,
    parentId: string | undefined,
    content: string,
    intermediateSteps: any[] = [],
    humanInteractionMessages: any[] = [],
    errorMessages: any[] = []
): Message => {
    return {
        role: 'assistant' as const,
        id,
        parentId,
        content,
        intermediateSteps,
        humanInteractionMessages,
        errorMessages,
        timestamp: Date.now(),
    };
};

/**
 * Updates conversation title from first user message if still default
 */
export const updateConversationTitle = (conversation: Conversation): Conversation => {
    const firstUserMessage = conversation.messages.find((m) => m.role === 'user');

    if (firstUserMessage?.content && conversation.name === 'New Conversation') {
        return {
            ...conversation,
            name: firstUserMessage.content.substring(0, 30),
        };
    }

    return conversation;
};

/**
 * Safely appends content to assistant message, handling empty content replacement
 */
export const appendToAssistantContent = (
    existingContent: string,
    incomingText: string
): string => {
    // Replace empty content entirely, otherwise append
    return existingContent === '' ? incomingText : existingContent + incomingText;
};

/**
 * Checks if an assistant message should be rendered (has content or intermediate steps)
 */
export const shouldRenderAssistantMessage = (message: Message): boolean => {
    const hasText = !!message.content?.trim();
    const hasSteps = !!(message.intermediateSteps && message.intermediateSteps.length > 0);

    return message.role !== 'assistant' || hasText || hasSteps;
};



