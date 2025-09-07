import React from 'react';

export const BotAvatar = ({height = 30, width = 30, src= ''}) =>  {

    const onError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
        console.error('error loading bot avatar');
        const target = event.target as HTMLImageElement;
        target.src = `ai-avatar.jpg`;
    };

    return <img 
        src={src} 
        alt="bot-avatar" 
        width={width}
        height={height}
        className='rounded-full max-w-full h-auto'
        onError={onError}
    />
}
