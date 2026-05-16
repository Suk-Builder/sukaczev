import { Link } from 'react-router-dom'

const footerLinks = [
  {
    title: '关于我们',
    links: [
      { label: '关于 Sukačev', href: '/about' },
      { label: '联系我们', href: '/contact' },
      { label: '加入我们', href: '/jobs' },
      { label: '友情链接', href: '/friends' },
    ],
  },
  {
    title: '帮助中心',
    links: [
      { label: '用户协议', href: '/terms' },
      { label: '隐私政策', href: '/privacy' },
      { label: '社区公约', href: '/guidelines' },
      { label: '侵权申诉', href: '/complaint' },
    ],
  },
  {
    title: '合作服务',
    links: [
      { label: '创作者服务', href: '/creator' },
      { label: '广告投放', href: '/ad' },
      { label: '企业合作', href: '/business' },
      { label: 'MCN入驻', href: '/mcn' },
    ],
  },
  {
    title: '更多',
    links: [
      { label: '客户端下载', href: '/download' },
      { label: 'Bug反馈', href: '/feedback' },
      { label: '站点地图', href: '/sitemap' },
      { label: '帮助文档', href: '/docs' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-white border-t border-bili-border mt-8">
      <div className="bili-container py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-bili-text-primary mb-4">{group.title}</h3>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-bili-text-secondary hover:text-bili-pink transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-bili-border-light mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#FB7299" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-semibold text-bili-text-primary">Sukačev</span>
          </div>
          <p className="text-xs text-bili-text-tertiary text-center">
            &copy; {new Date().getFullYear()} Sukačev. All rights reserved. | 本站内容仅供学习交流使用
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-bili-text-tertiary">京ICP备XXXXXXXX号</span>
            <span className="text-xs text-bili-text-tertiary">京公网安备XXXXXXXXXXX号</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
