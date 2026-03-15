正确步骤：
1.先把 app 从 .dmg 复制出来双击下载的 .dmg 文件（比如 Lobster_Manager_1.0.0_aarch64.dmg）。这会挂载一个虚拟磁盘，通常在桌面上出现一个叫 “Lobster Manager” 或类似名字的磁盘图标（像个硬盘）。
同时 Finder 会自动打开一个窗口，里面通常有：Lobster Manager.app 的图标（这是你要的程序）。
一个箭头指向“应用程序”文件夹的快捷方式（或直接写 “拖到这里”）。
把 Lobster Manager.app 拖到“应用程序”文件夹：在那个打开的 .dmg 窗口里，抓住 Lobster Manager.app 图标（不是 .dmg 文件本身！）。
拖到窗口右边的“应用程序”文件夹图标上（或直接拖到 Finder 侧边栏的“应用程序”）。
拖动时应该看到一个 + 号（表示复制），松手后它会复制过去。
如果拖不动或只拖出快捷方式（别名），试试按住 Option 键（⌥，Alt 键）再拖（强制复制而不是创建链接）。
弹出 .dmg 磁盘：复制完后，在 Finder 侧边栏或桌面上右键那个虚拟磁盘图标 → “推出” 或直接点右上角的弹出按钮。
现在 .dmg 可以删了（它只是安装包）。
去 Finder 检查：打开 Finder → 去菜单栏 “前往” → “应用程序”（或侧边栏直接点“应用程序”）。
现在应该看到 Lobster Manager.app 图标了！（如果还是没看到，搜 Spotlight：按 Command + Space，输入 “Lobster Manager”，看它出现在哪里。）
复制成功后，再解决“已损坏”问题一旦 app 在“应用程序”文件夹里了，双击它就会弹出“已损坏，无法打开”窗口 → 点“取消”/Done。
然后：立即去 系统设置 > 隐私与安全性 → 往下拉“安全性”部分，看有没有 “‘Lobster Manager’ 已阻止...” + “仍要打开” 按钮。
如果没弹 → 直接用终端方法（最稳）：打开终端。
复制：sudo xattr -r -d com.apple.quarantine （不要enter，这代码后面有个空格，别漏了。）
把 Finder 里的 Lobster Manager.app 图标拖到终端补全路径。
回车 → 输入密码 → 回车。
再双击 app 就能开了！
