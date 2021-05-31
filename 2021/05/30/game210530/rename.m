Path = '.\';                   % 设置数据存放的文件夹路径
File = dir(fullfile(Path,'*.png'));  % 显示文件夹下所有符合后缀名为.txt文件的完整信息
FileNames = {File.name}';            % 提取符合后缀名为.txt的所有文件的文件名，转换为n行1列
Length_Names = size(FileNames,1);    % 获取所提取数据文件的个数
New=FileNames;
for k = 1 : Length_Names
    % 连接路径和文件名得到完整的文件路径
    K_Trace = strcat(Path, FileNames(k));
    % 读取数据（因为这里是.txt格式数据，所以直接用load()函数)
    
    for j=1:length(FileNames{k})
        if FileNames{k}(j)==' ' || FileNames{k}(j)=='(' || FileNames{k}(j)==')' || FileNames{k}(j)=='™'
            New{k}(j)='_';
        end
    end
    
    %disp(FileNames{k})
    disp(['![ ](',New{k},')'])
    movefile(FileNames{k},New{k});
    %eval(['!rename',',',FileNames{k},',',New{k}])
end
