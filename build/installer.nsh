!ifndef BUILD_UNINSTALLER

  !define MUI_WELCOMEPAGE_TITLE "欢迎安装 YPW"
  !define MUI_WELCOMEPAGE_TEXT "YbirLWU Photograph Workstation（YPW）$\r$\n$\r$\n用于相机原片的核对、筛选、精修与批量水印导出，四个阶段依次进行。$\r$\n$\r$\n安装向导将引导你完成以下步骤：$\r$\n· 阅读并接受许可协议$\r$\n· 选择安装位置$\r$\n· 完成安装并启动$\r$\n$\r$\n点击「下一步」继续。"

  !define MUI_DIRECTORYPAGE_TEXT_TOP "安装程序将把 YPW 安装到下列文件夹。$\r$\n如需更改位置，点击「浏览」选择其他目录。"

  !define MUI_FINISHPAGE_RUN_TEXT "运行 YPW"
  !define MUI_FINISHPAGE_TITLE "安装完成"
  !define MUI_FINISHPAGE_TEXT "YPW 已安装到：$\r$\n$INSTDIR$\r$\n$\r$\n桌面与开始菜单快捷方式已创建。$\r$\n首次启动会进入欢迎页；可在「设置」中切换主题、绑定 Photoshop 或 Lightroom。"

  !macro customWelcomePage
    !insertmacro MUI_PAGE_WELCOME
  !macroend

!else

  !define MUI_UNWELCOMEPAGE_TITLE "卸载 YPW"
  !define MUI_UNWELCOMEPAGE_TEXT "即将从计算机中移除 YbirLWU Photograph Workstation。$\r$\n$\r$\n工作区中的照片与个人数据不会被删除。$\r$\n$\r$\n点击「下一步」继续。"

!endif
