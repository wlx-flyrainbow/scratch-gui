const zhimengStarterProjects = [
    {
        id: 'talking_character',
        deckId: 'talking',
        number: '01',
        title: '会说话的小角色',
        time: '3-5 分钟',
        description: '先让角色动起来，说一句话'
    },
    {
        id: 'birthday_animation',
        deckId: 'Tell-A-Story',
        number: '02',
        title: '生日祝福动画',
        time: '5-8 分钟',
        description: '换背景、加角色、做表达'
    },
    {
        id: 'catch_fruit_game',
        deckId: 'Chase-Game',
        number: '03',
        title: '接水果小游戏',
        time: '8-12 分钟',
        description: '第一次理解规则和互动'
    }
];

const getZhimengStarterProject = projectId => (
    zhimengStarterProjects.find(project => project.id === projectId)
);

export {
    zhimengStarterProjects as default,
    getZhimengStarterProject
};
