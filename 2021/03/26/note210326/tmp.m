files = dir(fullfile('D:\Blog\source\_posts\note210326'));
filesNum = size(files,1);
fileName={};
k=0;
for i=1:filesNum
    fileName_folder = fullfile('D:\Blog\source\_posts\note210326',files(i,1).name);
    if strfind(files(i,1).name,'_')
        newname= fullfile(' D:\Blog\source\_posts\note210326',files(i,1).name(2:end));
        eval(['!rename ' files(i,1).name ' ' files(i,1).name(2:end)]);
        fprintf('![ ](%s)\n',files(i,1).name(2:end))
        k=k+1;
    end
end
k